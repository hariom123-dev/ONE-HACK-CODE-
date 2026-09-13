import os
import hashlib
import json
import urllib.request
import urllib.parse
from fastapi import FastAPI, Request, Header, HTTPException
from eth_account import Account
from eth_account.messages import encode_typed_data
import uvicorn
from litellm import completion
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Live Web3 Data Node")

# Generate a random private key for the provider on startup
provider_account = Account.create()
print(f"Live Provider Node started with EIP-712 signing address: {provider_account.address}")

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
        raise HTTPException(status_code=400, detail="Missing X-Request-Id header for Web3 Escrow")
        
    try:
        body = await request.json()
    except:
        body = {}
        
    capability = body.get("capability", "unknown")
    input_data = body.get("input_data", "")
    
    content = ""
    
    # Execute Real Live Data Fetching and Processing
    if capability == "search":
        query = urllib.parse.quote(input_data)
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&utf8=&format=json"
        
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Web3LiveAgentNode/1.0'})
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode())
                search_results = res_data.get("query", {}).get("search", [])
                if search_results:
                    # Return the snippet of the top result
                    content = search_results[0].get("snippet", "No snippet found.")
                else:
                    content = "No results found on Wikipedia."
        except Exception as e:
            content = f"Wikipedia API error: {e}"
            
    elif capability == "summarize":
        try:
            prompt = f"Please provide a concise, high-quality summary of the following text:\n\n{input_data}"
            res = completion(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            content = res.choices[0].message.content
        except Exception as e:
            content = f"Summarization LLM error: {e}"
            
    elif capability == "translate":
        try:
            prompt = f"Please translate the following text into Spanish:\n\n{input_data}"
            res = completion(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            content = res.choices[0].message.content
        except Exception as e:
            content = f"Translation LLM error: {e}"
    else:
        content = f"Capability '{capability}' not supported on this node."

    step_output = content
    
    # Hash and Sign Delivery for the Smart Contract (HTTP 402 Extension)
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
    uvicorn.run(app, host="127.0.0.1", port=8001)
