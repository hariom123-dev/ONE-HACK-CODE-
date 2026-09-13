export type AgentStatus = 'idle' | 'running' | 'halted_by_contract' | 'completed' | 'failed';
export type PaymentStatus = 'pending' | 'paid' | 'delivered' | 'blocked_by_contract' | 'duplicate_skipped' | 'refunding';

export interface AgentStep {
  id: string;
  name: string;
  capability: string;
  provider: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'blocked';
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface PaymentEvent {
  id: string;
  timestamp: string;
  serviceUrl: string;
  capability: string;
  provider: string;
  amountUSDC: number;
  txHash?: string;
  requestHash?: string;
  deliveryHash?: string;
  status: PaymentStatus;
  idempotencyKey: string;
  blockNumber?: number;
  explorerUrl?: string;
}

export interface BudgetState {
  capUSDC: number;
  spentUSDC: number;
  remainingUSDC: number;
  isAgentBlocked: boolean;
  contractAddress?: string;
  agentAddress?: string;
  ownerAddress?: string;
}

export interface AgentSession {
  id: string;
  goal: string;
  status: AgentStatus;
  startedAt: string;
  finishedAt?: string;
  steps: AgentStep[];
  payments: PaymentEvent[];
  totalCostUSDC: number;
  finalOutput?: string;
  haltReason?: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  url: string;
  capability: string;
  priceUSDC: number;
  avgLatencyMs?: number;
  successRate?: number;
  isActive: boolean;
}

export type ActiveTab = 'dashboard' | 'run-agent' | 'audit' | 'providers' | 'history' | 'settings';