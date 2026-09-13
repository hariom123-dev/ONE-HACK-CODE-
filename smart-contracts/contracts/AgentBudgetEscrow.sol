// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentBudgetEscrow
 * @dev Enterprise-grade protocol firewall for Autonomous AI Agents.
 * Enforces per-tx caps, rolling epoch velocity limits, circuit breakers, and EIP-712 typed delivery proofs.
 */
contract AgentBudgetEscrow is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    
    // EIP-712 domain separation typehash for Proof of Delivery
    bytes32 public constant DELIVERY_PROOF_TYPEHASH = keccak256(
        "DeliveryProof(bytes32 requestHash,bytes32 deliveryHash,uint256 amount)"
    );

    // Rolling Epoch Rate-Limiting struct
    struct AgentAllowance {
        uint256 epochCap;        // Max spend allowed per epoch
        uint256 epochSpent;      // Amount spent/locked in current epoch
        uint256 epochDuration;   // Duration in seconds (e.g., 86400 for 1 day)
        uint256 lastEpochReset;  // Timestamp of epoch start
        uint256 maxPerTx;        // Hard ceiling per individual transaction
        bool isFrozen;           // Circuit breaker flag
    }

    struct Payment {
        address agent;
        address owner;
        address serviceProvider;
        uint256 amount;
        uint256 expiresAt;
        bool isCompleted;
    }

    mapping(address => mapping(address => AgentAllowance)) public allowances; // owner => agent => allowance
    mapping(bytes32 => Payment) public payments;

    event AllowanceSet(address indexed owner, address indexed agent, uint256 epochCap, uint256 epochDuration, uint256 maxPerTx);
    event AgentFrozenStateChanged(address indexed owner, address indexed agent, bool isFrozen);
    event PaymentLocked(bytes32 indexed requestHash, address indexed agent, address indexed provider, uint256 amount, uint256 expiresAt);
    event DeliveryRecorded(bytes32 indexed requestHash, address indexed provider, uint256 amount);
    event PaymentRefunded(bytes32 indexed requestHash, address indexed caller);

    error AgentFrozen();
    error ExceedsMaxPerTx(uint256 amount, uint256 maxPerTx);
    error EpochBudgetExceeded(uint256 amount, uint256 remaining);
    error InvalidProviderSignature();
    error PaymentAlreadyProcessed();
    error TimelockNotExpired();
    error InvalidCaller();
    error InvalidAddress();

    constructor(address _token) EIP712("AgentBudgetEscrow", "1") {
        if (_token == address(0)) revert InvalidAddress();
        token = IERC20(_token);
    }

    /**
     * @dev Sets budget velocity controls. Only callable by the owner (Smart Account).
     */
    function setAgentParameters(address agent, uint256 epochCap, uint256 epochDuration, uint256 maxPerTx) external {
        if (agent == address(0)) revert InvalidAddress();
        
        AgentAllowance storage a = allowances[msg.sender][agent];
        a.epochCap = epochCap;
        a.epochDuration = epochDuration;
        a.maxPerTx = maxPerTx;
        
        if (a.lastEpochReset == 0) {
            a.lastEpochReset = block.timestamp;
        }
        
        emit AllowanceSet(msg.sender, agent, epochCap, epochDuration, maxPerTx);
    }

    /**
     * @dev Master circuit breaker for compromised agents.
     */
    function freezeAgent(address agent, bool frozen) external {
        allowances[msg.sender][agent].isFrozen = frozen;
        emit AgentFrozenStateChanged(msg.sender, agent, frozen);
    }

    /**
     * @dev Agent invokes this via UserOp. Locks capital with rolling epoch verification.
     */
    function payForService(
        address owner,
        address serviceProvider,
        uint256 amount,
        bytes32 requestHash
    ) external nonReentrant {
        AgentAllowance storage a = allowances[owner][msg.sender];
        
        if (a.isFrozen) revert AgentFrozen();
        if (amount > a.maxPerTx) revert ExceedsMaxPerTx(amount, a.maxPerTx);
        
        // Reset rolling epoch if elapsed
        if (block.timestamp >= a.lastEpochReset + a.epochDuration) {
            a.epochSpent = 0;
            a.lastEpochReset = block.timestamp;
        }
        
        uint256 remaining = a.epochCap - a.epochSpent;
        if (amount > remaining) revert EpochBudgetExceeded(amount, remaining);

        a.epochSpent += amount;

        payments[requestHash] = Payment({
            agent: msg.sender,
            owner: owner,
            serviceProvider: serviceProvider,
            amount: amount,
            expiresAt: block.timestamp + 1 hours,
            isCompleted: false
        });

        token.safeTransferFrom(owner, address(this), amount);
        
        emit PaymentLocked(requestHash, msg.sender, serviceProvider, amount, block.timestamp + 1 hours);
    }

    /**
     * @dev Provider invokes this to claim payment. Requires EIP-712 cryptographic proof.
     */
    function recordDelivery(
        bytes32 requestHash,
        bytes32 deliveryHash,
        bytes memory providerSignature
    ) external nonReentrant {
        Payment storage payment = payments[requestHash];
        if (payment.isCompleted) revert PaymentAlreadyProcessed();
        
        // EIP-712 Domain Separation verification
        bytes32 structHash = keccak256(abi.encode(DELIVERY_PROOF_TYPEHASH, requestHash, deliveryHash, payment.amount));
        bytes32 typedDigest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(typedDigest, providerSignature);
        
        if (signer != payment.serviceProvider) revert InvalidProviderSignature();

        payment.isCompleted = true;
        token.safeTransfer(payment.serviceProvider, payment.amount);
        
        emit DeliveryRecorded(requestHash, payment.serviceProvider, payment.amount);
    }

    /**
     * @dev Reclaims funds post-timelock. Both Agent (refund daemon) and Owner can invoke.
     */
    function refund(bytes32 requestHash) external nonReentrant {
        Payment storage payment = payments[requestHash];
        if (payment.isCompleted) revert PaymentAlreadyProcessed();
        if (block.timestamp < payment.expiresAt) revert TimelockNotExpired();
        if (msg.sender != payment.agent && msg.sender != payment.owner) revert InvalidCaller();

        payment.isCompleted = true;
        
        // Return funds directly to the Smart Account
        token.safeTransfer(payment.owner, payment.amount);
        
        emit PaymentRefunded(requestHash, msg.sender);
    }

    /**
     * @dev View function for the Agent's pre-flight budget checks
     */
    function remainingBudget(address owner, address agent) external view returns (uint256) {
        AgentAllowance storage a = allowances[owner][agent];
        if (a.isFrozen) return 0;
        
        uint256 spent = a.epochSpent;
        if (block.timestamp >= a.lastEpochReset + a.epochDuration) {
            spent = 0;
        }
        
        if (spent >= a.epochCap) return 0;
        return a.epochCap - spent;
    }
}
