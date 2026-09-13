import json
import os
import asyncio
from typing import Dict, List
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

@dataclass
class Receipt:
    request_hash: str
    tx_hash: str
    provider_address: str
    amount_units: int
    delivery_hash: str
    provider_signature: str
    content_preview: str
    timestamp: str
    status: str

class ReceiptStore:
    """Hardened Receipt Store ensuring a forensic audit trail of payments and cryptographic deliveries."""
    def __init__(self, file_path: str = "agent_receipts.json"):
        self.file_path = file_path
        self._lock = asyncio.Lock()
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

    async def record_receipt(self, request_hash: str, tx_hash: str, provider_address: str, 
                             amount_units: int, delivery_hash: str, provider_signature: str, 
                             content_preview: str, status: str = "DELIVERED"):
        timestamp = datetime.now(timezone.utc).isoformat()
        receipt = Receipt(
            request_hash=request_hash,
            tx_hash=tx_hash,
            provider_address=provider_address,
            amount_units=amount_units,
            delivery_hash=delivery_hash,
            provider_signature=provider_signature,
            content_preview=content_preview[:200],
            timestamp=timestamp,
            status=status
        )
        
        async with self._lock:
            receipts = await self._read_all()
            receipts.append(asdict(receipt))
            await self._write_all(receipts)

    async def update_receipt_status(self, request_hash: str, new_status: str):
        async with self._lock:
            receipts = await self._read_all()
            for r in receipts:
                if r["request_hash"] == request_hash:
                    r["status"] = new_status
            await self._write_all(receipts)

    async def get_all_receipts(self) -> List[Dict]:
        async with self._lock:
            return await self._read_all()
