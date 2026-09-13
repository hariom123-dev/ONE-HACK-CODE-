import React, { useState, useRef, useCallback } from 'react';
import type {
  ActiveTab, AgentStep, PaymentEvent, AgentSession, BudgetState, AgentStatus
} from './types';

import {
  MOCK_BUDGET, MOCK_PAYMENTS, MOCK_SESSIONS, MOCK_PROVIDERS
} from './data/mockData';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { RunAgentView } from './components/RunAgentView';
import { AuditTrailView } from './components/AuditTrailView';
import { ProvidersView } from './components/ProvidersView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';

// ── Simulation helpers ───────────────────────────────────────────────────────
function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

/** Simulate the agent pipeline + WebSocket event stream */
async function simulateAgentRun(
  goal: string,
  isOverspend: boolean,
  budget: BudgetState,
  onStep: (s: AgentStep) => void,
  onPayment: (p: PaymentEvent) => void,
  onBudgetUpdate: (b: Partial<BudgetState>) => void,
  onDone: (output: string | null, haltReason?: string) => void
) {
  const steps = isOverspend
    ? [{ capability: 'compute', provider: 'InferenceCloud', name: 'Expensive Compute', url: 'http://localhost:4021/compute', cost: 10.0, required: true }]
    : [
        { capability: 'translation', provider: 'TranslateAPI Pro',  name: 'Translate Document', url: 'http://localhost:4021/translate', cost: 0.001, required: true },
        { capability: 'storage',     provider: 'StorageVault',      name: 'Store Output',       url: 'http://localhost:4021/store',     cost: 0.0005, required: true },
        { capability: 'compute',     provider: 'InferenceCloud',    name: 'Run Inference',      url: 'http://localhost:4021/compute',   cost: 0.0035, required: false },
      ];

  let totalSpent = budget.spentUSDC;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepId = `step-${makeId()}`;
    const reqHash = `0x${Math.random().toString(16).slice(2, 34).padStart(32, '0')}`;
    const ikey = `agent-001:${step.capability}:${String(i + 1).padStart(4, '0')}`;

    // Emit "running"
    onStep({ id: stepId, name: step.name, capability: step.capability, provider: step.provider, status: 'running' });

    await delay(900 + Math.random() * 600);

    // Check budget
    if (totalSpent + step.cost > budget.capUSDC) {
      // CONTRACT REVERT
      onStep({ id: stepId, name: step.name, capability: step.capability, provider: step.provider,
        status: 'blocked', error: `ContractRevertError: BudgetCapExceeded` });
      onPayment({
        id: makeId(), timestamp: new Date().toISOString(), serviceUrl: step.url,
        capability: step.capability, provider: step.provider, amountUSDC: step.cost,
        status: 'blocked_by_contract', idempotencyKey: ikey,
      });
      onBudgetUpdate({ isAgentBlocked: true });
      onDone(null, `ContractRevertError: BudgetCapExceeded — agent blocked at protocol layer (smart contract REVERT), not by agent logic. Attempted $${step.cost.toFixed(2)} but only $${(budget.capUSDC - totalSpent).toFixed(4)} remaining.`);
      return;
    }

    // Payment goes through
    const txHash = `0x${Math.random().toString(16).slice(2, 44)}`;
    const deliveryHash = `sha256:${Math.random().toString(16).slice(2, 34)}`;
    totalSpent += step.cost;

    onPayment({
      id: makeId(), timestamp: new Date().toISOString(), serviceUrl: step.url,
      capability: step.capability, provider: step.provider, amountUSDC: step.cost,
      txHash, requestHash: reqHash, deliveryHash, status: 'delivered',
      idempotencyKey: ikey,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
    });
    onBudgetUpdate({ spentUSDC: totalSpent, remainingUSDC: budget.capUSDC - totalSpent });
    onStep({ id: stepId, name: step.name, capability: step.capability, provider: step.provider, status: 'done' });

    await delay(300);
  }

  // All done
  await delay(600);
  onDone(`## Research Complete\n\n**Goal:** ${goal}\n\n**Services Used:**\n${steps.map(s => `- ${s.name} via ${s.provider} — $${s.cost.toFixed(4)} USDC`).join('\n')}\n\n**Total Cost:** $${totalSpent.toFixed(4)} USDC (verified on-chain)\n\nAll payments were settled through the **AgentBudgetEscrow** smart contract and delivery hashes verified on-chain.`);
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Budget state
  const [budget, setBudget] = useState<BudgetState>(MOCK_BUDGET);

  // All payment events (combined from mock + live)
  const [payments, setPayments] = useState<PaymentEvent[]>(MOCK_PAYMENTS);

  // Sessions
  const [sessions, setSessions] = useState<AgentSession[]>(MOCK_SESSIONS);

  // Live run state
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentPayments, setAgentPayments] = useState<PaymentEvent[]>([]);
  const [finalOutput, setFinalOutput] = useState<string | undefined>();
  const [haltReason, setHaltReason] = useState<string | undefined>();

  // Backend URL
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');

  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdateBudget = (newCap: number) => {
    setBudget(prev => ({
      ...prev,
      capUSDC: newCap,
      remainingUSDC: newCap - prev.spentUSDC,
    }));
    showToast(`Budget cap updated to $${newCap.toFixed(2)} USDC`);
  };

  const handleStartAgent = useCallback(async (goal: string, isOverspend: boolean) => {
    if (isSynthesizing) return;

    // Reset run state
    setAgentSteps([]);
    setAgentPayments([]);
    setFinalOutput(undefined);
    setHaltReason(undefined);
    setAgentStatus('running');
    setIsSynthesizing(true);
    setActiveTab('run-agent');

    const sessionId = makeId();
    const sessionStart = new Date().toISOString();
    const sessionPayments: PaymentEvent[] = [];
    const sessionSteps: AgentStep[] = [];

    await simulateAgentRun(
      goal,
      isOverspend,
      budget,
      (step) => {
        setAgentSteps(prev => {
          const idx = prev.findIndex(s => s.id === step.id);
          if (idx >= 0) { const n = [...prev]; n[idx] = step; return n; }
          return [...prev, step];
        });
        const existingIdx = sessionSteps.findIndex(s => s.id === step.id);
        if (existingIdx >= 0) sessionSteps[existingIdx] = step;
        else sessionSteps.push(step);
      },
      (payment) => {
        setAgentPayments(prev => [...prev, payment]);
        setPayments(prev => [payment, ...prev]);
        sessionPayments.push(payment);
      },
      (partial) => {
        setBudget(prev => ({ ...prev, ...partial }));
      },
      (output, halt) => {
        setFinalOutput(output ?? undefined);
        setHaltReason(halt);
        const status: AgentStatus = halt ? 'halted_by_contract' : 'completed';
        setAgentStatus(status);
        setIsSynthesizing(false);

        if (halt) showToast('⚠️ Agent blocked by smart contract');
        else showToast('✅ Agent completed successfully');

        const session: AgentSession = {
          id: sessionId, goal, status, startedAt: sessionStart,
          finishedAt: new Date().toISOString(),
          steps: [...sessionSteps], payments: [...sessionPayments],
          totalCostUSDC: sessionPayments.filter(p => p.status === 'delivered').reduce((s, p) => s + p.amountUSDC, 0),
          finalOutput: output ?? undefined, haltReason: halt,
        };
        setSessions(prev => [session, ...prev]);
      }
    );
  }, [isSynthesizing, budget]);

  const handleSelectSession = (session: AgentSession) => {
    setAgentSteps(session.steps);
    setAgentPayments(session.payments);
    setFinalOutput(session.finalOutput);
    setHaltReason(session.haltReason);
    setAgentStatus(session.status);
    setActiveTab('run-agent');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090B] text-[#F4F4F5] antialiased">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#27272A] text-[#F4F4F5] text-[13px] font-medium px-4 py-2.5 rounded-lg shadow-xl border border-[#3F3F46] flex items-center gap-2 animate-fade-in-down">
          <span className="material-symbols-outlined text-[18px] text-[#10B981] fill-1">check_circle</span>
          {toastMessage}
        </div>
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        setIsOpenMobile={setIsMobileMenuOpen}
        pendingBlock={budget.isAgentBlocked}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <TopBar
          activeTab={activeTab}
          budget={budget}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {activeTab === 'dashboard' && (
          <DashboardView
            budget={budget}
            recentPayments={payments}
            sessions={sessions}
            onGoToAudit={() => setActiveTab('audit')}
            onRunAgent={() => setActiveTab('run-agent')}
          />
        )}

        {activeTab === 'run-agent' && (
          <RunAgentView
            onStartAgent={handleStartAgent}
            isSynthesizing={isSynthesizing}
            agentSteps={agentSteps}
            agentPayments={agentPayments}
            agentStatus={agentStatus}
            finalOutput={finalOutput}
            haltReason={haltReason}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTrailView payments={payments} />
        )}

        {activeTab === 'providers' && (
          <ProvidersView providers={MOCK_PROVIDERS} />
        )}

        {activeTab === 'history' && (
          <HistoryView sessions={sessions} onSelectSession={handleSelectSession} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            budget={budget}
            onUpdateBudget={handleUpdateBudget}
            backendUrl={backendUrl}
            onUpdateBackendUrl={setBackendUrl}
          />
        )}
      </div>
    </div>
  );
}
