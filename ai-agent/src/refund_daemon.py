import asyncio
import json
import logging
import time
import os

logger = logging.getLogger(__name__)

class RefundDaemon:
    """
    Background worker that monitors stalled escrows and triggers refunds
    when the unlock timestamp has passed without a valid delivery receipt.
    """
    def __init__(self, wallet, receipt_store, file_path: str = "api_escrows.json"):
        self.wallet = wallet
        self.receipt_store = receipt_store
        self.file_path = file_path
        self._lock = asyncio.Lock()
        
        # Initialize file if it doesn't exist
        if not os.path.exists(self.file_path):
            with open(self.file_path, 'w') as f:
                json.dump([], f)

    async def _load_escrows(self):
        async with self._lock:
            try:
                with open(self.file_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load escrows: {e}")
                return []

    async def _save_escrows(self, escrows):
        async with self._lock:
            try:
                with open(self.file_path, 'w') as f:
                    json.dump(escrows, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to save escrows: {e}")

    async def register_escrow(self, request_hash: str, amount: int, unlock_timestamp: int, owner: str):
        """
        Registers a new escrow payment pending delivery.
        """
        escrows = await self._load_escrows()
        escrows.append({
            "request_hash": request_hash,
            "amount": amount,
            "unlock_timestamp": unlock_timestamp,
            "owner": owner,
            "status": "pending"
        })
        await self._save_escrows(escrows)
        logger.info(f"Registered pending escrow for {request_hash}. Unlocks at {unlock_timestamp}")

    async def run_daemon(self):
        """
        Infinite loop monitoring for expired escrows that need refunding.
        """
        logger.info("Refund Daemon started monitoring escrows.")
        while True:
            try:
                escrows = await self._load_escrows()
                state_changed = False
                
                for escrow in escrows:
                    if escrow.get("status") == "pending":
                        if time.time() >= escrow.get("unlock_timestamp", 0):
                            request_hash = escrow["request_hash"]
                            
                            # Cross-check receipt store
                            try:
                                receipt = await self.receipt_store.get_receipt(request_hash)
                            except AttributeError:
                                # Fallback if get_receipt is synchronous
                                receipt = self.receipt_store.get_receipt(request_hash)
                            
                            if receipt:
                                logger.info(f"Escrow {request_hash} completed successfully (receipt found).")
                                escrow["status"] = "completed"
                            else:
                                logger.warning(f"Escrow {request_hash} expired without receipt. Executing refund!")
                                try:
                                    tx_hash = await self.wallet.execute_refund(request_hash)
                                    logger.info(f"Refund executed for {request_hash}. Tx: {tx_hash}")
                                    escrow["status"] = "refunded"
                                except Exception as e:
                                    logger.error(f"Failed to execute refund for {request_hash}: {e}")
                                    # leave as pending to retry next loop
                                    continue
                                
                            state_changed = True
                            
                if state_changed:
                    await self._save_escrows(escrows)
                    
            except Exception as e:
                logger.error(f"Refund daemon encountered an error: {e}")
                
            await asyncio.sleep(60)
