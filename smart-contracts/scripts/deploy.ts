import { ethers, network, run } from "hardhat";

async function main() {
  console.log("Starting deployment...");
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  // 1. Deploy MockUSDC
  console.log("Deploying MockUSDC...");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log(`MockUSDC deployed to: ${mockUSDCAddress}`);

  // 2. Deploy AgentBudgetEscrow
  console.log("Deploying AgentBudgetEscrow...");
  const AgentBudgetEscrow = await ethers.getContractFactory("AgentBudgetEscrow");
  const escrow = await AgentBudgetEscrow.deploy(mockUSDCAddress);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`AgentBudgetEscrow deployed to: ${escrowAddress}`);

  // 3. Mint 10,000 MockUSDC to deployer
  console.log("Minting 10,000 MockUSDC to deployer...");
  // Assuming 6 decimals for MockUSDC to match real USDC
  const mintAmount = ethers.parseUnits("10000", 6); 
  const mintTx = await mockUSDC.mint(deployer.address, mintAmount);
  await mintTx.wait();
  console.log("MockUSDC minted successfully.");

  // Approve Escrow contract for MaxUint256
  console.log("Approving Escrow contract for MaxUint256...");
  const approveTx = await mockUSDC.approve(escrowAddress, ethers.MaxUint256);
  await approveTx.wait();
  console.log("Approval successful.");

  // 4. Set Agent Parameters
  console.log("Setting Agent Parameters...");
  const epochCap = ethers.parseUnits("100", 6);
  const epochDuration = 86400; // 1 day in seconds
  const maxPerTx = ethers.parseUnits("10", 6);

  const setParamsTx = await escrow.setAgentParameters(epochCap, epochDuration, maxPerTx);
  
  // 5. Verification on testnet
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for 5 block confirmations before verification...");
    await setParamsTx.wait(5);

    console.log("Verifying MockUSDC...");
    try {
      await run("verify:verify", {
        address: mockUSDCAddress,
        constructorArguments: [],
      });
    } catch (e: any) {
      console.log(`MockUSDC verification failed: ${e.message}`);
    }

    console.log("Verifying AgentBudgetEscrow...");
    try {
      await run("verify:verify", {
        address: escrowAddress,
        constructorArguments: [mockUSDCAddress],
      });
    } catch (e: any) {
      console.log(`AgentBudgetEscrow verification failed: ${e.message}`);
    }
  } else {
    await setParamsTx.wait();
  }

  console.log("Deployment script finished.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
