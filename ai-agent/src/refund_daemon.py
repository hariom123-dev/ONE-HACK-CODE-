import json
import os
import time
import asyncio
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

class EscrowRecoveryDaemon:
    """Automated Timelock Refund Daemon for autonomously reclaiming stalled escrows."""
    def __init__(self, wallet, receipt_store, file_path: str = "active_escrows.json"):
        self.wallet = wallet
        self.receipt_store = receipt_store
        self.file_path = file_path
        self._lock = asyncio.Lock()
        self._running = False
        
        if not os.path.exists(self.file_path):
            with open(self.file_path, "w") as f:
                json.dump([], f)

    async def _read_all(self) -> List[Dict]:
        def read():
            with open(self.file_path, "r") as f:
                return json.load(f)
        return await asyncio.to_thread(read)

    async def _write_all(self, data: List[Dict]):
        def write():
            with open(self.file_path, "w") as f:
                json.dump(data, f, indent=4)
        await asyncio.to_thread(write)

    async def register_escrow(self, request_hash: str, amount: int, unlock_timestamp: int, owner: str):
        escrow_record = {
            "request_hash": request_hash,
            "amount": amount,
            "unlock_timestamp": unlock_timestamp,
            "owner": owner,
            "status": "LOCKED"
        }
        async with self._lock:
            escrows = await self._read_all()
            escrows.append(escrow_record)
            await self._write_all(escrows)
        logger.info(f"Registered escrow for recovery: {request_hash}, unlocks at {unlock_timestamp}")

    async def start_monitoring(self, interval_seconds: int = 15):
        self._running = True
        logger.info("EscrowRecoveryDaemon started monitoring.")
        while self._running:
            try:
                current_time = int(time.time())
                async with self._lock:
                    escrows = await self._read_all()
                    updated_escrows = []
                    
                    for escrow in escrows:
                        if escrow["status"] != "LOCKED":
                            updated_escrows.append(escrow)
                            continue
                            
                        if current_time >= escrow["unlock_timestamp"]:
                            logger.info(f"Escrow {escrow['request_hash']} expired. Attempting refund...")
                            try:
                                tx_hash = await self.wallet.claim_refund(escrow["request_hash"])
                                logger.info(f"Refund claimed successfully: {tx_hash}")
                                escrow["status"] = "REFUNDED"
                                await self.receipt_store.update_receipt_status(escrow["request_hash"], "REFUNDED")
                            except Exception as e:
                                logger.error(f"Failed to claim refund for {escrow['request_hash']}: {e}")
                                error_str = str(e)
                                if "AlreadyClaimed" in error_str or "AlreadyRefunded" in error_str or "PaymentNotFound" in error_str:
                                    escrow["status"] = "RESOLVED_EXTERNALLY"
                                    
                        updated_escrows.append(escrow)
                    
                    await self._write_all(updated_escrows)
            except Exception as e:
                logger.error(f"Error in EscrowRecoveryDaemon loop: {e}")
                
            await asyncio.sleep(interval_seconds)
            
    def stop(self):
        self._running = False
