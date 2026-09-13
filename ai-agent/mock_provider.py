import os
import hashlib
from fastapi import FastAPI, Request, Header, HTTPException
from eth_account import Account
from eth_account.messages import encode_typed_data
import uvicorn

app = FastAPI()

# Generate a random private key for the provider on startup
provider_account = Account.create()
print(f"Mock Provider started with address: {provider_account.address}")

# Hardcoded or env-driven Escrow Address
ESCROW_ADDRESS = os.getenv("ESCROW_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
CHAIN_ID = int(os.getenv("CHAIN_ID", "31337"))

def sign_delivery(request_hash: bytes, delivery_hash: bytes) -> str:
    domain_data = {
        "name": "AgentBudgetEscrow",
        "version": "1",
        "chainId": CHAIN_ID,
        "verifyingContract": ESCROW_ADDRESS,
    }
    
    message_types = {
        "Delivery": [
            {"name": "requestHash", "type": "bytes32"},
            {"name": "deliveryHash", "type": "bytes32"},
        ]
    }
    
    message_data = {
        "requestHash": request_hash,
        "deliveryHash": delivery_hash
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
        "message": message_data
    }

    signable_message = encode_typed_data(full_message=structured_data)
    signed_message = Account.sign_message(signable_message, private_key=provider_account.key)
    
    return signed_message.signature.hex()

@app.post("/api/service")
async def service_endpoint(request: Request, x_request_id: str = Header(None)):
    if not x_request_id:
        raise HTTPException(status_code=400, detail="Missing X-Request-Id header")
        
    try:
        body = await request.json()
    except:
        body = {}
        
    capability = body.get("capability", "unknown")
    
    # Generate mock JSON results based on capability
    if capability == "search":
        content = "Search result: Ethereum state expiry is a proposed mechanism to remove inactive state from the active state tree to prevent state bloat, requiring users to provide witnesses to revive state."
    elif capability == "summarize":
        content = "Summary: Ethereum state expiry tackles blockchain bloat by archiving old, unused data. Users can retrieve this data later using cryptographic proofs, keeping the network fast and efficient for everyone."
    elif capability == "translate":
        content = "Translation: (Mock translated text regarding Ethereum state expiry)"
    else:
        content = f"Mock result for {capability}"

    result_payload = {
        "content": content,
        "status": "success"
    }
    
    step_output = result_payload["content"]
    delivery_hash_str = hashlib.sha256(str(step_output).encode()).hexdigest()
    delivery_hash_bytes = bytes.fromhex(delivery_hash_str)
    
    try:
        if x_request_id.startswith("0x"):
            req_hash_bytes = bytes.fromhex(x_request_id[2:])
        else:
            req_hash_bytes = bytes.fromhex(x_request_id)
        if len(req_hash_bytes) != 32:
            req_hash_bytes = req_hash_bytes.ljust(32, b'\0')
    except ValueError:
        req_hash_bytes = hashlib.sha256(x_request_id.encode()).digest()
        
    provider_signature = sign_delivery(req_hash_bytes, delivery_hash_bytes)
    
    final_result = {
        "content": step_output,
        "deliveryHash": delivery_hash_str,
        "providerSignature": provider_signature
    }
    
    return final_result

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
