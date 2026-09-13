import asyncio
import json
import subprocess
import time
import urllib.request
import urllib.error
import websockets
import sys

# ANSI Color Codes
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
    
    try:
        async with websockets.connect(uri) as websocket:
            print("\n\033[92m✅ Connected! Waiting for agent events...\033[0m\n")
            
            # Now trigger the research request asynchronously
            request_data = json.dumps({
                "goal": "Research Ethereum ERC-7715 Session Keys and summarize the benefits"
            }).encode('utf-8')
            
            req = urllib.request.Request(
                "http://localhost:8080/api/research", 
                data=request_data, 
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            try:
                urllib.request.urlopen(req)
                print("\033[96m🚀 Research Goal Submitted Successfully!\033[0m\n")
            except Exception as e:
                print(f"\n\033[91m❌ Failed to submit research request: {e}\033[0m\n")
                return

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
                        formatted_data = json.dumps(data, indent=2)
                        indented_data = "\n".join(f"    {line}" for line in formatted_data.split("\n"))
                        print(indented_data)
                    print("-" * 50)
                    
                    if event_type in ["RESEARCH_COMPLETED", "RESEARCH_HALTED", "failed"]:
                        print(f"\n\033[92m🏁 Terminal state reached ({event_type}). Disconnecting.\033[0m\n")
                        break
                        
                except json.JSONDecodeError:
                    print(f"⚠️ Received non-JSON message: {message}")
                    
    except Exception as e:
        print(f"\n\033[91m⚠️ WebSocket error: {e}\033[0m")

def wait_for_api():
    print("⏳ Waiting for API Server to boot...")
    for _ in range(10):
        try:
            req = urllib.request.Request("http://localhost:8080/docs")
            with urllib.request.urlopen(req) as response:
                if response.getcode() == 200:
                    print("✅ API Server is up!")
                    return True
        except urllib.error.URLError:
            time.sleep(1)
    print("❌ API Server failed to boot within 10 seconds.")
    return False

def main():
    print("==========================================================")
    print("🌐 ONE-CLICK ORCHESTRATOR: W3A-1 LIVE ECOSYSTEM 🌐")
    print("==========================================================")
    
    live_provider_process = None
    api_server_process = None
    
    try:
        print("[1/3] Launching Live Provider Node...")
        live_provider_process = subprocess.Popen(
            [sys.executable, "live_provider.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        print("[2/3] Launching API Server Bridge...")
        api_server_process = subprocess.Popen(
            [sys.executable, "api_server.py"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        if not wait_for_api():
            return
            
        print("[3/3] Triggering Ecosystem execution and Telemetry listener...")
        asyncio.run(listen_to_telemetry())
        
    except KeyboardInterrupt:
        print("\n\033[93m🛑 Orchestrator manually interrupted.\033[0m")
    finally:
        print("\n🧹 Commencing clean teardown...")
        if live_provider_process:
            live_provider_process.terminate()
            live_provider_process.wait()
            print("✔️ Live Provider Node terminated.")
        if api_server_process:
            api_server_process.terminate()
            api_server_process.wait()
            print("✔️ API Server Bridge terminated.")
        print("✅ Teardown complete. Ports are free.")

if __name__ == "__main__":
    main()
