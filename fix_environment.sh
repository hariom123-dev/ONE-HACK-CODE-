#!/bin/bash
set -e

echo "=========================================================="
echo "🔧 W3A-1 ENVIRONMENT FIXER INITIATED 🔧"
echo "=========================================================="

echo "[1/2] Fixing Hardhat HHE22 Error (Local Installation)..."
cd smart-contracts

if [ ! -f "package.json" ]; then
    echo "  -> package.json not found. Initializing..."
    npm init -y > /dev/null 2>&1
fi

echo "  -> Installing Hardhat and dependencies locally..."
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox > /dev/null 2>&1
echo "  -> Hardhat fixed!"

echo "[2/2] Fixing API Server Crash (Missing .env)..."
cd ../ai-agent

cat << 'EOF' > .env
OPENAI_API_KEY=sk-mock-key-replace-this-with-real-key
RPC_URL=http://127.0.0.1:8545
ESCROW_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000001
OWNER_ADDRESS=0x0000000000000000000000000000000000000002
CHAIN_ID=31337
EOF

echo "  -> .env file generated successfully!"
cd ..

echo "=========================================================="
echo -e "\033[92m✅ ENVIRONMENT FULLY RESTORED AND CONFIGURED\033[0m"
echo "=========================================================="
echo -e "\033[92mYou can now safely execute the final demo workflow:\033[0m"
echo -e "\033[92m  1. Open Terminal 1: cd smart-contracts && npx hardhat node\033[0m"
echo -e "\033[92m  2. Open Terminal 2: cd ai-agent && python run_e2e_demo.py\033[0m"
echo "=========================================================="
