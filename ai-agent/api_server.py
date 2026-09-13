import os
import asyncio
import json
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# Core agent components
from src.wallet import AgentWallet
from src.session_key import SessionKeyManager
from src.receipt_store import ReceiptStore
from src.planner import ResearchPlanner
from src.service_registry import ServiceRegistry
from src.refund_daemon import RefundDaemon
from src.llm_engine import LLMEngine
from src.agent import AutonomousAgent

app = FastAPI(title="Web3 AI Agent API Bridge")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

async def websocket_event_listener(event: dict):
    """
    Stringifies the agent's telemetry events and broadcasts them 
    to all active WebSocket clients.
    """
    event_str = json.dumps(event)
    await manager.broadcast(event_str)

class ResearchRequest(BaseModel):
    goal: str

@app.post("/api/research")
async def start_research(request: ResearchRequest):
    """
    Spins up the AutonomousAgent pipeline, wiring it to the REAL smart contract.
    """
    
    # 1. Wire API to Real Smart Contract
    rpc_url = os.getenv("RPC_URL", "http://localhost:8545")
    escrow_address = os.getenv("ESCROW_CONTRACT_ADDRESS")
    owner_address = os.getenv("OWNER_ADDRESS")
    
    if not escrow_address or not owner_address:
        return {"status": "error", "message": "Missing ESCROW_CONTRACT_ADDRESS or OWNER_ADDRESS in .env"}

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    # Minimal ABI covering wallet dependencies for remaining budget, locking, and refunding
    MINIMAL_ABI = [
        {
            "inputs": [
                {"internalType": "address", "name": "owner", "type": "address"},
                {"internalType": "address", "name": "agent", "type": "address"}
            ],
            "name": "remainingBudget",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {"internalType": "bytes32", "name": "requestHash", "type": "bytes32"},
                {"internalType": "address", "name": "serviceProvider", "type": "address"},
                {"internalType": "uint256", "name": "amount", "type": "uint256"}
            ],
            "name": "lockFunds",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
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
        },
        {
            "inputs": [
                {"internalType": "bytes32", "name": "requestHash", "type": "bytes32"}
            ],
            "name": "refund",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
    
    real_contract = w3.eth.contract(address=w3.to_checksum_address(escrow_address), abi=MINIMAL_ABI)
    
    # 2. Initialize Agent Components connected to real EVM
    session_key_manager = SessionKeyManager()
    wallet = AgentWallet(w3, real_contract, owner_address=w3.to_checksum_address(owner_address), session_key_manager=session_key_manager)
    receipt_store = ReceiptStore(file_path="api_receipts.json")
    llm_engine = LLMEngine(model="gpt-4o-mini")
    service_registry = ServiceRegistry()
    
    # Map to Real Data Service Node (live_provider.py on port 8001)
    live_url = "http://127.0.0.1:8001/api/service"
    service_registry.providers = [
        {"name": "LiveSearch", "url": live_url, "capability": "search", "price": 100000},
        {"name": "LiveSummarize", "url": live_url, "capability": "summarize", "price": 200000},
        {"name": "LiveTranslate", "url": live_url, "capability": "translate", "price": 100000},
    ]
    
    planner = ResearchPlanner(llm_engine, service_registry)
    refund_daemon = RefundDaemon(wallet, receipt_store, file_path="api_escrows.json")
    
    # 3. Initialize AutonomousAgent
    agent = AutonomousAgent(
        agent_id="API-Live-Agent",
        wallet=wallet,
        receipt_store=receipt_store,
        planner=planner,
        service_registry=service_registry,
        refund_daemon=refund_daemon,
        llm_engine=llm_engine,
        event_listener=websocket_event_listener
    )
    
    # 4. Background execution
    asyncio.create_task(agent.conduct_research(request.goal))
    
    return {"status": "agent_started", "goal": request.goal}

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for frontends to listen to real-time agent telemetry.
    """
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
