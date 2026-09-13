import React from 'react';
import type { BudgetState, PaymentEvent, AgentSession } from '../types';

interface DashboardViewProps {
  budget: BudgetState;
  recentPayments: PaymentEvent[];
  sessions: AgentSession[];
  onGoToAudit: () => void;
  onRunAgent: () => void;
}

const StatusDot: React.FC<{ status: PaymentEvent['status'] }> = ({ status }) => {
  const map: Record<PaymentEvent['status'], { color: string; icon: string }> = {
    delivered:            { color: '#10B981', icon: 'check_circle' },
    paid:                 { color: '#34D399', icon: 'payments' },
    pending:              { color: '#A1A1AA', icon: 'hourglass_empty' },
    blocked_by_contract:  { color: '#EF4444', icon: 'block' },
    duplicate_skipped:    { color: '#F59E0B', icon: 'content_copy' },
    refunding:            { color: '#60A5FA', icon: 'currency_exchange' },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className="material-symbols-outlined text-[16px] fill-1 shrink-0" style={{ color: cfg.color }}>
      {cfg.icon}
    </span>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  budget, recentPayments, sessions, onGoToAudit, onRunAgent
}) => {
  const pct = budget.capUSDC > 0 ? (budget.spentUSDC / budget.capUSDC) * 100 : 0;
  const barColor = budget.isAgentBlocked ? '#EF4444' : pct > 80 ? '#F59E0B' : '#10B981';
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const blockedSessions = sessions.filter(s => s.status === 'halted_by_contract').length;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      {/* Block alert banner */}
      {budget.isAgentBlocked && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/40 rounded-xl p-4 flex items-start gap-3 animate-pulse-border">
          <span className="material-symbols-outlined text-[22px] text-[#EF4444] fill-1 mt-0.5 shrink-0">block</span>
          <div>
            <p className="font-bold text-[#EF4444] text-[14px]">Agent Blocked at Contract Layer</p>
            <p className="text-[#D4D4D8] text-[13px] mt-0.5">
              The AI agent attempted to exceed its spending cap. The smart contract reverted the transaction.
              This is enforced at the EVM protocol level — the agent cannot bypass it.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Budget Cap" value={`$${budget.capUSDC.toFixed(2)}`} sub="USDC (on-chain)" icon="shield" color="#10B981" />
        <StatCard label="Total Spent" value={`$${budget.spentUSDC.toFixed(4)}`} sub="USDC this session" icon="payments" color="#34D399" />
        <StatCard label="Remaining" value={`$${budget.remainingUSDC.toFixed(4)}`} sub="USDC available" icon="savings" color={budget.isAgentBlocked ? '#EF4444' : '#10B981'} />
        <StatCard label="Sessions" value={String(sessions.length)} sub={`${completedSessions} done · ${blockedSessions} blocked`} icon="smart_toy" color="#60A5FA" />
      </div>

      {/* Budget meter */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#10B981]">account_balance</span>
            <span className="text-[14px] font-bold text-[#F4F4F5]">Smart Contract Budget Meter</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-[#A1A1AA]">
              {pct.toFixed(1)}% used
            </span>
            {budget.isAgentBlocked && (
              <span className="text-[11px] font-bold text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded animate-pulse">
                BLOCKED
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-[#27272A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
          />
        </div>

        {/* Budget labels */}
        <div className="flex justify-between mt-2 text-[11px] font-mono">
          <span className="text-[#A1A1AA]">$0.0000</span>
          <span className="text-[#F4F4F5] font-bold">${budget.spentUSDC.toFixed(4)} spent</span>
          <span className="text-[#A1A1AA]">${budget.capUSDC.toFixed(2)} cap</span>
        </div>

        {/* Contract info strip */}
        <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
          <ContractChip label="Contract" value={budget.contractAddress} />
          <ContractChip label="Agent" value={budget.agentAddress} />
          <ContractChip label="Owner" value={budget.ownerAddress} />
        </div>

        <div className="mt-3 p-3 bg-[#09090B] rounded-lg border border-[#27272A]">
          <p className="text-[11px] text-[#52525B] font-mono">
            <span className="text-[#10B981]">require</span>(amount &lt;= cap - spent, <span className="text-[#F59E0B]">"BudgetCapExceeded"</span>);
            <span className="text-[#52525B] ml-2">// AgentBudgetEscrow.sol:L58</span>
          </p>
          <p className="text-[10px] text-[#3F3F46] mt-1">
            EVM REVERT — agent physically cannot exceed this cap regardless of its own reasoning
          </p>
        </div>
      </div>

      {/* Two columns: recent payments + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent payments */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#A1A1AA]">receipt_long</span>
              <span className="text-[13px] font-bold text-[#D4D4D8]">Recent Payments</span>
            </div>
            <button onClick={onGoToAudit} className="text-[11px] text-[#10B981] hover:underline font-medium">
              View all →
            </button>
          </div>
          <div className="divide-y divide-[#27272A]">
            {recentPayments.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <StatusDot status={p.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[#D4D4D8] truncate">{p.capability}</p>
                  <p className="text-[10px] text-[#52525B] font-mono truncate">{p.provider}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[12px] font-mono font-bold ${p.status === 'blocked_by_contract' ? 'text-[#EF4444]' : 'text-[#F4F4F5]'}`}>
                    {p.status === 'blocked_by_contract' ? '🚫' : ''} ${p.amountUSDC.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-[#52525B]">
                    {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 space-y-3">
          <p className="text-[13px] font-bold text-[#D4D4D8] mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[#A1A1AA]">bolt</span>
            Quick Actions
          </p>
          <ActionBtn icon="smart_toy" label="Run AI Agent" sub="Start a new service-buying task" onClick={onRunAgent} accent />
          <ActionBtn icon="receipt_long" label="View Audit Trail" sub="Check payment + delivery proofs" onClick={onGoToAudit} />
          <ActionBtn
            icon="bug_report"
            label="Demo: Trigger Overspend"
            sub="Watch the contract REVERT live"
            onClick={onRunAgent}
            danger
          />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; sub: string; icon: string; color: string }> = ({ label, value, sub, icon, color }) => (
  <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2 mb-1">
      <span className="material-symbols-outlined text-[16px]" style={{ color }}>{icon}</span>
      <span className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-[22px] font-bold font-mono text-[#F4F4F5] leading-none">{value}</p>
    <p className="text-[11px] text-[#52525B]">{sub}</p>
  </div>
);

const ContractChip: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="flex items-center gap-1.5 bg-[#27272A] px-2 py-1 rounded-md border border-[#3F3F46]">
    <span className="text-[#A1A1AA] font-medium">{label}:</span>
    <span className="font-mono text-[#F4F4F5]">
      {value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'}
    </span>
  </div>
);

const ActionBtn: React.FC<{ icon: string; label: string; sub: string; onClick: () => void; accent?: boolean; danger?: boolean }> = ({
  icon, label, sub, onClick, accent, danger
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left cursor-pointer ${
      accent
        ? 'border-[#10B981]/40 bg-[#10B981]/5 hover:bg-[#10B981]/10'
        : danger
        ? 'border-[#EF4444]/30 bg-[#EF4444]/5 hover:bg-[#EF4444]/10'
        : 'border-[#3F3F46] bg-[#27272A] hover:bg-[#3F3F46]'
    }`}
  >
    <span className={`material-symbols-outlined text-[20px] shrink-0 ${accent ? 'text-[#10B981]' : danger ? 'text-[#EF4444]' : 'text-[#A1A1AA]'}`}>
      {icon}
    </span>
    <div>
      <p className={`text-[13px] font-bold ${accent ? 'text-[#10B981]' : danger ? 'text-[#EF4444]' : 'text-[#F4F4F5]'}`}>{label}</p>
      <p className="text-[11px] text-[#A1A1AA]">{sub}</p>
    </div>
    <span className="material-symbols-outlined text-[16px] text-[#52525B] ml-auto">chevron_right</span>
  </button>
);
