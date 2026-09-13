import asyncio
import json
from unittest.mock import MagicMock
from web3 import Web3

from src.wallet import AgentWallet
from src.session_key import SessionKeyManager
from src.receipt_store import ReceiptStore
from src.planner import ResearchPlanner
from src.service_registry import ServiceRegistry
from src.refund_daemon import RefundDaemon
from src.llm_engine import LLMEngine
from src.agent import AutonomousAgent

async def event_listener(event: dict):
    """Pretty-prints the agent's telemetry events with color coding."""
    event_type = event.get("type")
    data = event.get("data", {})
    
    colors = {
        "RESEARCH_STARTED": "\033[94m", # Blue
        "PLAN_GENERATED": "\033[96m", # Cyan
        "PRE_FLIGHT_CHECK": "\033[93m", # Yellow
        "STEP_STARTED": "\033[92m", # Green
        "DELIVERY_VERIFIED": "\033[95m", # Magenta
        "SYNTHESIZING_FINAL_OUTPUT": "\033[94m",
        "REFLECTION_STARTED": "\033[93m",
        "EVALUATION_COMPLETED": "\033[91m", # Red for critic
        "REVISION_STARTED": "\033[93m",
        "RESEARCH_COMPLETED": "\033[92m",
        "RESET": "\033[0m"
    }
    
    color = colors.get(event_type, "\033[97m") # White default
    reset = colors["RESET"]
    
    print(f"\n{color}▶ [{event_type}]{reset}")
    for k, v in data.items():
        print(f"  {k}: {v}")

async def main():
    print("\n=======================================================")
    print("🚀 Web3 AI Agent - End-to-End Success Path Demo 🚀")
    print("=======================================================\n")
    
    # 1. Initialize Mocks and Web3
    w3 = Web3(Web3.HTTPProvider("http://localhost:8545"))
    mock_contract = MagicMock()
    # Ensure budget check passes
    mock_contract.functions.remainingBudget.return_value.call.return_value = int(100e6) # 100 USDC
    # Ensure lock funds works
    mock_contract.functions.lockFunds.return_value.build_transaction.return_value = {"to": "0x123", "data": "0x"}
    
    # 2. Initialize Agent Components
    session_key_manager = SessionKeyManager()
    wallet = AgentWallet(w3, mock_contract, owner_address="0xMockOwnerAddress", session_key_manager=session_key_manager)
    receipt_store = ReceiptStore(file_path="mock_receipts.json")
    llm_engine = LLMEngine(model="gpt-4o-mini")
    service_registry = ServiceRegistry()
    
    # 3. Register mock_provider.py in ServiceRegistry
    # We map all requested capabilities to our local mock provider on port 8000
    mock_url = "http://127.0.0.1:8000/api/service"
    service_registry.providers = [
        {"name": "LocalSearch", "url": mock_url, "capability": "search", "price": 0.001},
        {"name": "LocalSummarize", "url": mock_url, "capability": "summarize", "price": 0.002},
        {"name": "LocalTranslate", "url": mock_url, "capability": "translate", "price": 0.001},
    ]
    
    planner = ResearchPlanner(llm_engine, service_registry)
    refund_daemon = RefundDaemon(wallet, receipt_store, file_path="mock_escrows.json")
    
    # 4. Initialize AutonomousAgent
    agent = AutonomousAgent(
        agent_id="Agent-007",
        wallet=wallet,
        receipt_store=receipt_store,
        planner=planner,
        service_registry=service_registry,
        refund_daemon=refund_daemon,
        llm_engine=llm_engine,
        event_listener=event_listener
    )
    
    # 5. Trigger Research
    goal = "Research Ethereum state expiry and summarize it for a non-technical audience"
    final_state = await agent.conduct_research(goal)
    
    # 6. Print Final Output and State
    print("\n=======================================================")
    print("✅ EXECUTION COMPLETE - FINAL STATE Dump")
    print("=======================================================\n")
    print(json.dumps(final_state, indent=2))
    
    if final_state.get("final_output"):
        print("\n=======================================================")
        print("🧠 FINAL SYNTHESIZED (AND CRITIQUED) KNOWLEDGE:")
        print("=======================================================\n")
        print(final_state["final_output"])
        print("\n=======================================================")

if __name__ == "__main__":
    asyncio.run(main())
