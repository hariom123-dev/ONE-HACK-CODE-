import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Contract, Signer } from "ethers";

describe("AgentBudgetEscrow - Institutional Protocol Firewall", function () {
    let escrow: Contract;
    let usdc: Contract;
    let owner: Signer;
    let agent: Signer;
    let provider: Signer;
    let rando: Signer;

    const EPOCH_CAP = ethers.parseUnits("100", 6);
    const MAX_PER_TX = ethers.parseUnits("50", 6);
    const EPOCH_DURATION = 86400; // 1 day

    beforeEach(async function () {
        [owner, agent, provider, rando] = await ethers.getSigners();

        // Deploy Mock USDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.deploy();
        await usdc.waitForDeployment();

        // Mint and approve for the Owner (Smart Account)
        await usdc.connect(owner).mint(await owner.getAddress(), ethers.parseUnits("1000", 6));

        // Deploy Escrow
        const Escrow = await ethers.getContractFactory("AgentBudgetEscrow");
        escrow = await Escrow.deploy(await usdc.getAddress());
        await escrow.waitForDeployment();

        await usdc.connect(owner).approve(await escrow.getAddress(), ethers.parseUnits("1000", 6));

        // Set advanced velocity parameters for the Agent
        await escrow.connect(owner).setAgentParameters(
            await agent.getAddress(),
            EPOCH_CAP,
            EPOCH_DURATION,
            MAX_PER_TX
        );
    });

    it("REVERTS: ExceedsMaxPerTx when a single service call exceeds maxPerTx", async function () {
        const reqHash = ethers.keccak256(ethers.toUtf8Bytes("req1"));
        await expect(
            escrow.connect(agent).payForService(
                await owner.getAddress(),
                await provider.getAddress(),
                ethers.parseUnits("51", 6), // Requesting 51, Limit is 50
                reqHash
            )
        ).to.be.revertedWithCustomError(escrow, "ExceedsMaxPerTx");
    });

    it("ROLLING EPOCH RESET: Blocked agent can spend after epochDuration", async function () {
        const req1 = ethers.keccak256(ethers.toUtf8Bytes("req1"));
        const req2 = ethers.keccak256(ethers.toUtf8Bytes("req2"));
        const req3 = ethers.keccak256(ethers.toUtf8Bytes("req3"));

        // Max out epoch (50 + 50 = 100)
        await escrow.connect(agent).payForService(await owner.getAddress(), await provider.getAddress(), ethers.parseUnits("50", 6), req1);
        await escrow.connect(agent).payForService(await owner.getAddress(), await provider.getAddress(), ethers.parseUnits("50", 6), req2);

        // Third should fail due to epoch limit
        await expect(
            escrow.connect(agent).payForService(await owner.getAddress(), await provider.getAddress(), ethers.parseUnits("10", 6), req3)
        ).to.be.revertedWithCustomError(escrow, "EpochBudgetExceeded");

        // Advance EVM time by 1 day + 1 second
        await network.provider.send("evm_increaseTime", [86401]);
        await network.provider.send("evm_mine");

        // Third should now succeed because the rolling epoch reset
        await expect(
            escrow.connect(agent).payForService(await owner.getAddress(), await provider.getAddress(), ethers.parseUnits("10", 6), req3)
        ).to.emit(escrow, "PaymentLocked");
    });

    it("CIRCUIT BREAKER: Frozen agent cannot lock funds", async function () {
        // Owner triggers circuit breaker
        await escrow.connect(owner).freezeAgent(await agent.getAddress(), true);
        
        const reqHash = ethers.keccak256(ethers.toUtf8Bytes("req1"));
        await expect(
            escrow.connect(agent).payForService(
                await owner.getAddress(),
                await provider.getAddress(),
                ethers.parseUnits("10", 6),
                reqHash
            )
        ).to.be.revertedWithCustomError(escrow, "AgentFrozen");
    });

    it("EIP-712 VERIFICATION: Valid EIP-712 typed data unlocks funds", async function () {
        const reqHash = ethers.keccak256(ethers.toUtf8Bytes("req1"));
        const amount = ethers.parseUnits("10", 6);
        
        await escrow.connect(agent).payForService(
            await owner.getAddress(),
            await provider.getAddress(),
            amount,
            reqHash
        );

        const deliveryHash = ethers.keccak256(ethers.toUtf8Bytes("payload"));
        
        // Construct EIP-712 Domain and Typed Data exactly as defined in the Contract
        const domain = {
            name: "AgentBudgetEscrow",
            version: "1",
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await escrow.getAddress()
        };

        const types = {
            DeliveryProof: [
                { name: "requestHash", type: "bytes32" },
                { name: "deliveryHash", type: "bytes32" },
                { name: "amount", type: "uint256" }
            ]
        };

        const value = {
            requestHash: reqHash,
            deliveryHash: deliveryHash,
            amount: amount
        };

        // Ethers automatically handles hashing the typed data struct and signing it
        const signature = await provider.signTypedData(domain, types, value);

        // Verify that the exact EIP-712 signature works
        await expect(escrow.connect(provider).recordDelivery(reqHash, deliveryHash, signature))
            .to.emit(escrow, "DeliveryRecorded")
            .withArgs(reqHash, await provider.getAddress(), amount);

        // Ensure funds transferred to provider
        expect(await usdc.balanceOf(await provider.getAddress())).to.equal(amount);
    });
});
