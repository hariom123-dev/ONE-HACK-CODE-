import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import json
import asyncio

# Patch dependencies before importing app to avoid triggering real EVM/LLM
with patch("api_server.Web3"), patch("api_server.AgentWallet"):
    from api_server import app, manager, websocket_event_listener

client = TestClient(app)

def test_post_research():
    with patch("api_server.AutonomousAgent") as MockAgent, patch("asyncio.create_task") as MockTask:
        mock_instance = MockAgent.return_value
        mock_instance.conduct_research = AsyncMock()
        
        response = client.post("/api/research", json={"goal": "Test Goal"})
        
        assert response.status_code == 200
        assert response.json() == {"status": "agent_started", "goal": "Test Goal"}
        MockTask.assert_called_once()

def test_websocket_telemetry():
    with client.websocket_connect("/ws/telemetry") as websocket:
        # We manually invoke the event listener to test the websocket bridge
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        event_data = {"type": "RESEARCH_STARTED", "data": {"goal": "Test"}}
        
        # Broadcasting the event stringifies and sends to all active websockets
        loop.run_until_complete(websocket_event_listener(event_data))
        
        data = websocket.receive_text()
        parsed = json.loads(data)
        assert parsed["type"] == "RESEARCH_STARTED"
        assert parsed["data"]["goal"] == "Test"
        loop.close()
