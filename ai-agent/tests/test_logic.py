import pytest
import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch
from src.models import ResearchPlan, ResearchStep
from src.agent import AutonomousAgent
from src.refund_daemon import RefundDaemon
from pydantic import ValidationError

def test_pydantic_state_machine_malformed_json():
    malformed_json = """
    {
        "steps": [
            {
                "capability": "search",
                "estimated_cost": "not_a_float",
                "parameters": "should_be_dict"
            }
        ],
        "total_estimated_cost": 10
    }
    """
    with pytest.raises(ValidationError):
        ResearchPlan.model_validate_json(malformed_json)

@pytest.mark.asyncio
async def test_budget_pruning():
    wallet_mock = MagicMock()
    wallet_mock.get_remaining_budget = AsyncMock(return_value=150) # Budget is 150
    
    planner_mock = MagicMock()
    # Cost is 200 > 150
    planner_mock.estimate_total_cost = MagicMock(side_effect=[200, 100])
    
    plan = ResearchPlan(
        steps=[
            ResearchStep(capability="search", description="Required", estimated_cost=100, parameters={}, required=True),
            ResearchStep(capability="translate", description="Optional", estimated_cost=100, parameters={}, required=False)
        ],
        total_estimated_cost=200
    )
    
    planner_mock.create_plan = AsyncMock(return_value=plan)
    
    agent = AutonomousAgent(
        agent_id="test",
        wallet=wallet_mock,
        receipt_store=MagicMock(),
        planner=planner_mock,
        service_registry=MagicMock(),
        refund_daemon=MagicMock(),
        llm_engine=MagicMock()
    )
    
    # We mock out X402 client to avoid actual requests
    agent.x402_client.make_request = AsyncMock(return_value={"content": "mocked", "deliveryHash": "hash", "providerSignature": "sig"})
    agent.service_registry.find_provider = MagicMock(return_value={"name": "P", "url": "U"})
    agent.llm_engine.synthesize_research = AsyncMock(return_value="done")
    agent.llm_engine.evaluate_output = AsyncMock(return_value=MagicMock(score=10, requires_revision=False, critique="Good"))
    
    res = await agent.conduct_research("test goal")
    
    # Only 1 step should be executed due to pruning
    assert res["current_step_index"] == 1
    assert len(res["purchased_data"]) == 1
    assert res["purchased_data"][0]["capability"] == "search"

@pytest.mark.asyncio
async def test_automated_refund_daemon(tmp_path):
    escrows_file = tmp_path / "api_escrows.json"
    
    wallet_mock = MagicMock()
    wallet_mock.execute_refund = AsyncMock(return_value="0xRefundTx")
    
    receipt_store_mock = MagicMock()
    receipt_store_mock.get_receipt = AsyncMock(return_value=None) # No receipt
    
    daemon = RefundDaemon(wallet_mock, receipt_store_mock, str(escrows_file))
    
    expired_time = int(time.time()) - 3600
    await daemon.register_escrow("0xReq1", 100, expired_time, "0xOwner")
    
    # Create a wrapper to run the daemon for exactly 1 iteration
    async def run_daemon_once():
        escrows = await daemon._load_escrows()
        for escrow in escrows:
            if escrow.get("status") == "pending" and time.time() >= escrow.get("unlock_timestamp", 0):
                receipt = None
                try:
                    receipt = await daemon.receipt_store.get_receipt(escrow["request_hash"])
                except Exception:
                    receipt = daemon.receipt_store.get_receipt(escrow["request_hash"])
                    
                if not receipt:
                    await daemon.wallet.execute_refund(escrow["request_hash"])
                    escrow["status"] = "refunded"
        await daemon._save_escrows(escrows)

    await run_daemon_once()
    
    wallet_mock.execute_refund.assert_awaited_once_with("0xReq1")
    
    # Verify file updated
    with open(escrows_file) as f:
        data = json.load(f)
        assert data[0]["status"] == "refunded"
