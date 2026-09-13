import asyncio
import json
import websockets

# ANSI Color Codes for beautiful terminal output
COLORS = {
    "RESEARCH_STARTED": "\033[94m",      # Blue
    "PLAN_GENERATED": "\033[96m",        # Cyan
    "PRE_FLIGHT_CHECK": "\033[93m",      # Yellow
    "STEP_STARTED": "\033[92m",          # Green
    "DELIVERY_VERIFIED": "\033[95m",     # Magenta
    "FUNDS_LOCKED": "\033[91m",          # Red
    "SYNTHESIZING_FINAL_OUTPUT": "\033[94m", # Blue
    "REFLECTION_STARTED": "\033[93m",    # Yellow
    "EVALUATION_COMPLETED": "\033[91m",  # Red
    "REVISION_STARTED": "\033[93m",      # Yellow
    "RESEARCH_COMPLETED": "\033[92m",    # Green
    "RESEARCH_HALTED": "\033[91m",       # Red
    "RESET": "\033[0m"                   # Reset
}

async def listen_to_telemetry():
    uri = "ws://localhost:8080/ws/telemetry"
    print(f"📡 Connecting to Web3 AI Agent Telemetry Stream at {uri}...")
    
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                print("\n\033[92m✅ Connected! Waiting for agent events...\033[0m\n")
                
                while True:
                    message = await websocket.recv()
                    
                    try:
                        event = json.loads(message)
                        event_type = event.get("type", "UNKNOWN_EVENT")
                        data = event.get("data", {})
                        
                        color = COLORS.get(event_type, "\033[97m") # Default white
                        reset = COLORS["RESET"]
                        
                        print(f"{color}▶ [{event_type}]{reset}")
                        
                        if data:
                            # Format and indent the data payload beautifully
                            formatted_data = json.dumps(data, indent=2)
                            # Indent each line by 4 spaces
                            indented_data = "\n".join(f"    {line}" for line in formatted_data.split("\n"))
                            print(indented_data)
                        print("-" * 50)
                        
                    except json.JSONDecodeError:
                        print(f"⚠️ Received non-JSON message: {message}")
                        
        except websockets.exceptions.ConnectionClosed:
            print("\n\033[91m❌ Connection closed. Reconnecting in 3 seconds...\033[0m")
            await asyncio.sleep(3)
        except ConnectionRefusedError:
            print("\n\033[91m⚠️ Connection refused. Is the API server running? Retrying in 3 seconds...\033[0m")
            await asyncio.sleep(3)
        except Exception as e:
            print(f"\n\033[91m⚠️ Unexpected error: {e}. Retrying in 3 seconds...\033[0m")
            await asyncio.sleep(3)

if __name__ == "__main__":
    try:
        asyncio.run(listen_to_telemetry())
    except KeyboardInterrupt:
        print("\n\033[93m🛑 Telemetry client stopped by user.\033[0m")
