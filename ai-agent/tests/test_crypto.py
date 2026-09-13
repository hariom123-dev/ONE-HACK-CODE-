import pytest
from unittest.mock import MagicMock
import hashlib
from eth_account import Account
from eth_account.messages import encode_typed_data
from src.wallet import AgentWallet
from src.session_key import SessionKeyManager
from src.x402_client import X402Client

def test_wallet_erc7715_erc4337():
    w3_mock = MagicMock()
    w3_mock.to_bytes.side_effect = lambda hexstr: bytes.fromhex(hexstr[2:] if hexstr.startswith('0x') else hexstr)
    w3_mock.to_hex.side_effect = lambda text: "0x" + text.encode('utf-8').hex()
    
    contract_mock = MagicMock()
    skm = SessionKeyManager()
    skm.delegation_payload = "dummy_delegation_payload"
    
    wallet = AgentWallet(w3_mock, contract_mock, "0xOwnerAddress", skm)
    
    user_op = {
        "sender": "0xOwnerAddress",
        "callData": "0x1234",
        "signature": "0x"
    }
    
    signed_op = wallet._sign_user_op(user_op)
    
    assert "signature" in signed_op
    assert signed_op["signature"] != "0x"
    
    # Validate payload is appended
    delegation_hex = "0x" + "dummy_delegation_payload".encode('utf-8').hex()
    assert signed_op["signature"].endswith(delegation_hex[2:])

def test_eip712_validation_x402_client():
    client = X402Client(wallet=MagicMock(), chain_id=31337)
    
    provider_account = Account.create()
    
    request_hash = hashlib.sha256(b"test_request").digest()
    delivery_hash = hashlib.sha256(b"test_delivery").digest()
    
    domain_data = {
        "name": "AgentBudgetEscrow",
        "version": "1",
        "chainId": 31337,
        "verifyingContract": "0x0000000000000000000000000000000000000000",
    }
    message_types = {
        "Delivery": [
            {"name": "requestHash", "type": "bytes32"},
            {"name": "deliveryHash", "type": "bytes32"},
        ]
    }
    
    structured_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            **message_types
        },
        "primaryType": "Delivery",
        "domain": domain_data,
        "message": {
            "requestHash": request_hash,
            "deliveryHash": delivery_hash
        }
    }
    
    signable_message = encode_typed_data(full_message=structured_data)
    signed_message = Account.sign_message(signable_message, private_key=provider_account.key)
    
    recovered_address = Account.recover_message(signable_message, signature=signed_message.signature)
    assert recovered_address == provider_account.address
