import logging
import hashlib
import time
from eth_account.messages import encode_typed_data
from eth_account import Account

logger = logging.getLogger(__name__)

class X402Client:
    """
    X402 HTTP client supporting ERC-7715 Session Keys & EIP-712 Cryptographic Delivery Proofs.
    """
    def __init__(self, wallet, chain_id: int = 31337):
        self.wallet = wallet
        self.chain_id = chain_id
        
    async def make_request(self, service_url: str, payload: dict, agent_id: str) -> dict:
        """
        Executes the 402 challenge flow. (Mocked network execution for hackathon).
        Normally, this sends an HTTP request, gets a 402 Payment Required with price,
        calls wallet.pay_for_service, and sends X-Payment-Proof.
        """
        # 1. Generate Idempotency Key (Request Hash)
        nonce = str(time.time())
        idempotency_str = f"{agent_id}:{service_url}:{nonce}"
        request_hash = "0x" + hashlib.sha256(idempotency_str.encode()).hexdigest()
        
        # 2. Assume 402 returned a cost of 1000 units and provider address
        price = 1000 
        provider = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" # Hardhat account #1
        
        # 3. Pay for service
        logger.info(f"Locking {price} tokens in escrow for {service_url}")
        payment_receipt = await self.wallet.pay_for_service(provider, price, request_hash)
        
        # 4. Mock Provider response with EIP-712 signature over delivery payload
        mock_output = f"Mock research result for {payload.get('capability')}."
        delivery_hash = "0x" + hashlib.sha256(mock_output.encode()).hexdigest()
        
        # Provider would sign the EIP-712 struct
        # For demonstration, we just mock the signature string that the provider would return.
        mock_provider_signature = "0xMOCK_EIP712_SIGNATURE_FROM_PROVIDER"
        
        result = {
            "content": mock_output,
            "deliveryHash": delivery_hash,
            "providerSignature": mock_provider_signature,
            "providerAddress": provider,
            "amount": price,
            "requestHash": request_hash
        }
        
        return result

    def verify_delivery_signature(self, request_hash: bytes, delivery_hash: bytes, amount: int, provider_address: str, provider_signature: str) -> bool:
        """
        Verifies the EIP-712 typed delivery proof from the service provider.
        """
        # EIP-712 Domain matching the Smart Contract
        domain_data = {
            "name": "AgentBudgetEscrow",
            "version": "1",
            "chainId": self.chain_id,
            "verifyingContract": self.wallet.contract.address
        }
        
        # Typed Struct matching the Smart Contract definition
        message_types = {
            "DeliveryProof": [
                {"name": "requestHash", "type": "bytes32"},
                {"name": "deliveryHash", "type": "bytes32"},
                {"name": "amount", "type": "uint256"}
            ]
        }
        
        message_data = {
            "requestHash": request_hash,
            "deliveryHash": delivery_hash,
            "amount": amount
        }
        
        # Encode typed data using eth_account standards
        signable_message = encode_typed_data(
            domain_data=domain_data,
            message_types=message_types,
            message_data=message_data
        )
        
        try:
            # Recover the signer from the EIP-712 typed digest
            recovered_signer = Account.recover_message(signable_message, signature=provider_signature)
            is_valid = recovered_signer.lower() == provider_address.lower()
            
            if not is_valid:
                logger.error(f"Signer mismatch. Expected {provider_address}, got {recovered_signer}")
            return is_valid
        except Exception as e:
            logger.error(f"EIP-712 signature verification failed: {e}")
            return False
