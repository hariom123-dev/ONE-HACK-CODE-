import { expect } from "chai";
import { ethers, network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentBudgetEscrow - Exhaustive Test Suite", function () {
  let escrow: any;
  let usdc: any;
  let owner: SignerWithAddress;
  let provider: SignerWithAddress;
  let agent: SignerWithAddress;

  const EPOCH_CAP = ethers.parseUnits("100", 6);
  const MAX_PER_TX = ethers.parseUnits("10", 6);
  const EPOCH_DURATION = 86400; // 1 day

  beforeEach(async function () {
    [owner, provider, agent] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy();

    const Escrow = await ethers.getContractFactory("AgentBudgetEscrow");
    escrow = await Escrow.deploy(await usdc.getAddress());

    await escrow.setAgentParameters(EPOCH_CAP, EPOCH_DURATION, MAX_PER_TX);

    await usdc.mint(owner.address, ethers.parseUnits("10000", 6));
    await usdc.connect(owner).approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  describe("1. Rolling Epochs", function () {
    it("Should revert with EpochBudgetExceeded if cap is exceeded", async function () {
      const requestHash = ethers.encodeBytes32String("req1");
      const amount = EPOCH_CAP + 1n; 

      await expect(
        escrow.connect(agent).payForService(owner.address, provider.address, amount, requestHash)
      ).to.be.revertedWith("EpochBudgetExceeded");
    });
    
    it("Should reset exactly after epochDuration", async function () {
        // Assume hitting max capacity
        for(let i=0; i<10; i++) {
            await escrow.connect(agent).payForService(owner.address, provider.address, MAX_PER_TX, ethers.encodeBytes32String(`req_${i}`));
        }
        
        await expect(
            escrow.connect(agent).payForService(owner.address, provider.address, 1n, ethers.encodeBytes32String("req_11"))
        ).to.be.revertedWith("EpochBudgetExceeded");
        
        // Time travel
        await time.increase(EPOCH_DURATION + 1);
        
        // Should succeed now
        await expect(
            escrow.connect(agent).payForService(owner.address, provider.address, 1n, ethers.encodeBytes32String("req_12"))
        ).to.not.be.reverted;
    });
  });

  describe("2. Per-Tx Ceilings", function () {
    it("Should revert with ExceedsMaxPerTx even if epoch budget has room", async function () {
      const requestHash = ethers.encodeBytes32String("req2");
      const amount = MAX_PER_TX + 1n;
      
      await expect(
        escrow.connect(agent).payForService(owner.address, provider.address, amount, requestHash)
      ).to.be.revertedWith("ExceedsMaxPerTx");
    });
  });

  describe("3. Emergency Circuit Breaker", function () {
    it("Should block payForService but allow recordDelivery after freeze", async function () {
      const requestHash = ethers.encodeBytes32String("req_freeze");
      await escrow.connect(agent).payForService(owner.address, provider.address, MAX_PER_TX, requestHash);
      
      await escrow.connect(owner).freezeAgent();
      
      await expect(
          escrow.connect(agent).payForService(owner.address, provider.address, MAX_PER_TX, ethers.encodeBytes32String("req_blocked"))
      ).to.be.revertedWith("AgentIsFrozen");
      
      const deliveryHash = ethers.encodeBytes32String("delivery");
      
      const domain = {
        name: "AgentBudgetEscrow",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await escrow.getAddress()
      };
      
      const types = {
          Delivery: [
              { name: "requestHash", type: "bytes32" },
              { name: "deliveryHash", type: "bytes32" }
          ]
      };
      
      const signature = await provider.signTypedData(domain, types, {
          requestHash, deliveryHash
      });
      
      await expect(
          escrow.connect(provider).recordDelivery(requestHash, deliveryHash, signature)
      ).to.not.be.reverted;
    });
  });

  describe("4. EIP-712 Cryptography", function () {
    it("Should transfer USDC on valid signature, revert on invalid/tampered", async function () {
      const requestHash = ethers.encodeBytes32String("req_crypto");
      const amount = MAX_PER_TX;
      await escrow.connect(agent).payForService(owner.address, provider.address, amount, requestHash);
      
      const deliveryHash = ethers.encodeBytes32String("delivery_valid");
      const domain = {
        name: "AgentBudgetEscrow",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await escrow.getAddress()
      };
      const types = {
          Delivery: [
              { name: "requestHash", type: "bytes32" },
              { name: "deliveryHash", type: "bytes32" }
          ]
      };
      
      const signature = await provider.signTypedData(domain, types, { requestHash, deliveryHash });
      
      const providerBalBefore = await usdc.balanceOf(provider.address);
      await escrow.connect(owner).recordDelivery(requestHash, deliveryHash, signature);
      const providerBalAfter = await usdc.balanceOf(provider.address);
      
      expect(providerBalAfter - providerBalBefore).to.equal(amount);
      
      // Tampered
      const requestHash2 = ethers.encodeBytes32String("req_crypto2");
      await escrow.connect(agent).payForService(owner.address, provider.address, amount, requestHash2);
      
      const tamperedDeliveryHash = ethers.encodeBytes32String("tampered");
      await expect(
          escrow.connect(owner).recordDelivery(requestHash2, tamperedDeliveryHash, signature)
      ).to.be.revertedWith("InvalidSignature");
    });
  });

  describe("5. Timelock Refunds", function () {
    it("Should revert if called before expiresAt, return funds after", async function () {
      const requestHash = ethers.encodeBytes32String("req_refund");
      const amount = MAX_PER_TX;
      await escrow.connect(agent).payForService(owner.address, provider.address, amount, requestHash);
      
      await expect(escrow.connect(owner).refund(requestHash)).to.be.revertedWith("TimelockActive");
      
      await time.increase(3601);
      
      const ownerBalBefore = await usdc.balanceOf(owner.address);
      await escrow.connect(owner).refund(requestHash);
      const ownerBalAfter = await usdc.balanceOf(owner.address);
      
      expect(ownerBalAfter - ownerBalBefore).to.equal(amount);
    });
  });
});
