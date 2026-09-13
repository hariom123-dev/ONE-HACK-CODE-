#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 THE MASTER LAUNCHER: W3A-1 LIVE ECOSYSTEM 🚀"
echo "=========================================================="

# 1. Environment Setup
echo "[1/4] Running Environment Fixer..."
chmod +x fix_environment.sh
./fix_environment.sh

# 2. API Key Injection
echo "[2/4] Verifying OpenAI API Key configuration..."
ENV_FILE="ai-agent/.env"
CURRENT_KEY=$(grep "OPENAI_API_KEY" "$ENV_FILE" | cut -d '=' -f 2)

if [ "$CURRENT_KEY" = "sk-mock-key-replace-this-with-real-key" ] || [ -z "$CURRENT_KEY" ]; then
    echo -e "\033[93m⚠️ Action Required: Real OpenAI API Key needed to trigger live LLM models.\033[0m"
    read -p "Please enter your OpenAI API Key (sk-...): " USER_KEY
    if [ -n "$USER_KEY" ]; then
        # Use sed -i.bak for macOS compatibility
        sed -i.bak "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=${USER_KEY}/" "$ENV_FILE"
        rm -f "${ENV_FILE}.bak"
        echo -e "\033[92m✅ Key securely injected into .env\033[0m"
    else
        echo -e "\033[91m❌ No key provided. Exiting.\033[0m"
        exit 1
    fi
else
    echo "✅ OpenAI API Key already configured."
fi

# 3. Process Management (The Trap)
HARDHAT_PID=""
cleanup() {
    echo -e "\n\033[93m🛑 Terminating background blockchain node (PID: $HARDHAT_PID)...\033[0m"
    if [ -n "$HARDHAT_PID" ]; then
        kill "$HARDHAT_PID" 2>/dev/null || true
    fi
    echo -e "\033[92m✅ Cleanup complete. Exiting.\033[0m"
}
trap cleanup EXIT INT TERM

# 4. Boot the Blockchain
echo "[3/4] Booting local Hardhat EVM Node..."
cd smart-contracts
npx hardhat node > hardhat.log 2>&1 &
HARDHAT_PID=$!
echo "⏳ Waiting 4 seconds for EVM to boot on port 8545..."
sleep 4
cd ..

# 5. Boot the AI Orchestrator
echo "[4/4] Launching Foreground AI Orchestrator..."
cd ai-agent
python run_e2e_demo.py
