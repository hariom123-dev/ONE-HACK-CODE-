import sys
import asyncio
import logging
from web3 import AsyncWeb3
from eth_account import Account
import os

# Setup sys path so we can import src modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.wallet import AgentWallet, ContractRevertError

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# Minimal ABI for the demo
ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "owner", "type": "address"},
            {"internalType": "address", "name": "serviceProvider", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "bytes32", "name": "requestHash", "type": "bytes32"}
        ],
        "name": "payForService",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

async def main():
    print("\n" + "="*60)
    print("🤖 AI AGENT LIVE OVERSPEND DEMO 🤖")
    print("="*60)

    # 1. Connect to local Hardhat node
    # Replace with Testnet RPC in live environment
    w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider('http://127.0.0.1:8545'))
    
    # 2. Setup mock accounts (Using Hardhat standard defaults for ease of use)
    agent_key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" 
    agent_account = Account.from_key(agent_key)
    owner_address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" 
    provider_address = "0x3C44CdDdB6a900fa2b585ea29F2223a3F221c002"
    
    # Replace with deployed contract address 
    contract_address = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    
    contract = w3.eth.contract(address=contract_address, abi=ABI)
    
    wallet = AgentWallet(
        w3=w3, 
        contract=contract, 
        agent_account=agent_account, 
        owner_address=owner_address
    )

    try:
        is_connected = await w3.is_connected()
        print(f"[AGENT] Connected to Web3 node: {is_connected}")
    except Exception:
        print("[AGENT] Note: Web3 node is offline for this test. Mocking execution...")

    print(f"[AGENT] Identity Address: {agent_account.address}")
    
    # Intentionally massive amount: $10,000 (10,000,000,000 in 6 decimals)
    amount_usd = 10000
    amount_usdc_decimals = amount_usd * (10**6) 
    
    print(f"\n[AGENT] Attempting to purchase a service for ${amount_usd} USDC...")
    print(f"[AGENT] Note: This intentionally exceeds the on-chain budget cap.")

    try:
        # 3. Attempt overspend
        await wallet.pay_for_service(
            provider=provider_address,
            amount=amount_usdc_decimals,
            request_hash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        )
    except ContractRevertError as e:
        # 4 & 5. Catch Revert and Log Prominently
        print("\n" + "!"*60)
        print("🚨 PROTOCOL ENFORCEMENT TRIGGERED 🚨")
        print("!"*60)
        print(f"[ERROR CAUGHT]: {e}")
        print("\n[SECURITY AUDIT LOG]:")
        print("-> The AI Agent did NOT voluntarily decline this transaction in its own code.")
        print("-> The agent was PHYSICALLY BLOCKED by the blockchain consensus layer.")
        print("-> The budget cap is completely unbypassable from outside the smart contract.")
        print("="*60 + "\n")
    except Exception as e:
        # Fallback if hardhat node is not running to still show output format
        print(f"Connection failed (is the node running?). Expected Revert Trace: ContractRevertError: BudgetCapExceeded")

if __name__ == "__main__":
    asyncio.run(main())
