import type { AgentSession, PaymentEvent, ServiceProvider, BudgetState } from '../types';


// ── Mock budget state ────────────────────────────────────────────────────────
export const MOCK_BUDGET: BudgetState = {
  capUSDC: 0.10,
  spentUSDC: 0.0085,
  remainingUSDC: 0.0915,
  isAgentBlocked: false,
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  agentAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  ownerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
};

// ── Mock service providers ───────────────────────────────────────────────────
export const MOCK_PROVIDERS: ServiceProvider[] = [
  {
    id: 'provider-a',
    name: 'TranslateAPI Pro',
    url: 'http://localhost:4021/translate',
    capability: 'translation',
    priceUSDC: 0.001,
    avgLatencyMs: 340,
    successRate: 0.98,
    isActive: true,
  },
  {
    id: 'provider-b',
    name: 'StorageVault',
    url: 'http://localhost:4021/store',
    capability: 'storage',
    priceUSDC: 0.0005,
    avgLatencyMs: 120,
    successRate: 0.99,
    isActive: true,
  },
  {
    id: 'provider-c',
    name: 'InferenceCloud',
    url: 'http://localhost:4021/compute',
    capability: 'compute',
    priceUSDC: 0.0035,
    avgLatencyMs: 890,
    successRate: 0.95,
    isActive: true,
  },
  {
    id: 'provider-d',
    name: 'SearchOracle',
    url: 'http://localhost:4021/search',
    capability: 'search',
    priceUSDC: 0.0025,
    avgLatencyMs: 620,
    successRate: 0.97,
    isActive: false,
  },
];

// ── Mock payment events ──────────────────────────────────────────────────────
export const MOCK_PAYMENTS: PaymentEvent[] = [
  {
    id: 'pay-1',
    timestamp: '2026-09-13T04:58:21Z',
    serviceUrl: 'http://localhost:4021/translate',
    capability: 'translation',
    provider: 'TranslateAPI Pro',
    amountUSDC: 0.001,
    txHash: '0xAB12CD34EF56...78',
    requestHash: '0x1a2b3c4d...',
    deliveryHash: 'sha256:ef349a21bc88...',
    status: 'delivered',
    idempotencyKey: 'agent-001:translate:0001',
    blockNumber: 18234567,
    explorerUrl: 'https://sepolia.etherscan.io/tx/0xAB12CD34EF5678',
  },
  {
    id: 'pay-2',
    timestamp: '2026-09-13T04:58:43Z',
    serviceUrl: 'http://localhost:4021/store',
    capability: 'storage',
    provider: 'StorageVault',
    amountUSDC: 0.0005,
    txHash: '0xCC99DD88AA77...',
    requestHash: '0x5e6f7a8b...',
    deliveryHash: 'sha256:77c4a193de12...',
    status: 'delivered',
    idempotencyKey: 'agent-001:store:0002',
    blockNumber: 18234570,
    explorerUrl: 'https://sepolia.etherscan.io/tx/0xCC99DD88AA77',
  },
  {
    id: 'pay-3',
    timestamp: '2026-09-13T04:59:01Z',
    serviceUrl: 'http://localhost:4021/compute',
    capability: 'compute',
    provider: 'InferenceCloud',
    amountUSDC: 0.0035,
    txHash: '0xFF00EE11DD22...',
    requestHash: '0x9c0d1e2f...',
    deliveryHash: 'sha256:aa5512fcb301...',
    status: 'delivered',
    idempotencyKey: 'agent-001:compute:0003',
    blockNumber: 18234574,
    explorerUrl: 'https://sepolia.etherscan.io/tx/0xFF00EE11DD22',
  },
  {
    id: 'pay-4',
    timestamp: '2026-09-13T04:59:11Z',
    serviceUrl: 'http://localhost:4021/compute',
    capability: 'compute',
    provider: 'InferenceCloud',
    amountUSDC: 0.05,
    status: 'blocked_by_contract',
    idempotencyKey: 'agent-001:compute:0004',
  },
  {
    id: 'pay-5',
    timestamp: '2026-09-13T04:59:22Z',
    serviceUrl: 'http://localhost:4021/translate',
    capability: 'translation',
    provider: 'TranslateAPI Pro',
    amountUSDC: 0.001,
    txHash: '0xAB12CD34EF56...78',
    requestHash: '0x1a2b3c4d...',
    deliveryHash: 'sha256:ef349a21bc88...',
    status: 'duplicate_skipped',
    idempotencyKey: 'agent-001:translate:0001',
  },
];

// ── Mock sessions ────────────────────────────────────────────────────────────
export const MOCK_SESSIONS: AgentSession[] = [
  {
    id: 'session-1',
    goal: 'Translate, store, and analyze the quarterly earnings report',
    status: 'completed',
    startedAt: '2026-09-13T04:58:15Z',
    finishedAt: '2026-09-13T04:59:05Z',
    payments: MOCK_PAYMENTS.slice(0, 3),
    totalCostUSDC: 0.0085,
    steps: [
      { id: 's1', name: 'Translate Document', capability: 'translation', provider: 'TranslateAPI Pro', status: 'done', startedAt: '2026-09-13T04:58:21Z', finishedAt: '2026-09-13T04:58:35Z' },
      { id: 's2', name: 'Store Output', capability: 'storage', provider: 'StorageVault', status: 'done', startedAt: '2026-09-13T04:58:36Z', finishedAt: '2026-09-13T04:58:44Z' },
      { id: 's3', name: 'Run Inference', capability: 'compute', provider: 'InferenceCloud', status: 'done', startedAt: '2026-09-13T04:58:45Z', finishedAt: '2026-09-13T04:59:05Z' },
    ],
    finalOutput: '## Analysis Complete\n\nThe quarterly report has been translated into English, stored on-chain, and analyzed.\n\n**Key Findings:**\n- Revenue up 12% YoY\n- Operating margin improved to 24%\n- All payments verified via x402 + smart contract escrow',
  },
  {
    id: 'session-2',
    goal: 'Run high-cost compute job that exceeds budget cap',
    status: 'halted_by_contract',
    startedAt: '2026-09-13T04:59:08Z',
    finishedAt: '2026-09-13T04:59:12Z',
    payments: [MOCK_PAYMENTS[3]],
    totalCostUSDC: 0,
    steps: [
      { id: 's4', name: 'Expensive Compute', capability: 'compute', provider: 'InferenceCloud', status: 'blocked', startedAt: '2026-09-13T04:59:10Z', error: 'ContractRevertError: BudgetCapExceeded' },
    ],
    haltReason: 'ContractRevertError: BudgetCapExceeded — agent blocked at protocol layer, not by agent logic',
  },
];

// ── Agent goal suggestions ───────────────────────────────────────────────────
export const GOAL_SUGGESTIONS = [
  { id: 'g1', title: 'Translate & Store Report', query: 'Translate a research paper from French to English and store it on IPFS' },
  { id: 'g2', title: 'Multi-provider Search', query: 'Search for recent AI safety papers across two providers and compare pricing' },
  { id: 'g3', title: 'Compute + Verify', query: 'Run ML inference on a dataset and verify the delivery hash on-chain' },
  { id: 'g4', title: '🚨 Test Budget Cap', query: 'DEMO: Attempt an overspend scenario to trigger the smart contract revert' },
];
