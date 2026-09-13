import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentStep, PaymentEvent, AgentStatus } from '../types';
import { GOAL_SUGGESTIONS } from '../data/mockData';

interface RunAgentViewProps {
  onStartAgent: (goal: string, isOverspendDemo: boolean) => void;
  isSynthesizing: boolean;
  agentSteps: AgentStep[];
  agentPayments: PaymentEvent[];
  agentStatus: AgentStatus;
  finalOutput?: string;
  haltReason?: string;
}

export const RunAgentView: React.FC<RunAgentViewProps> = ({
  onStartAgent, isSynthesizing, agentSteps, agentPayments, agentStatus, finalOutput, haltReason
}) => {
  const [goal, setGoal] = useState('');
  const [isPipelineOpen, setIsPipelineOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentSteps, finalOutput, isSynthesizing]);

  const totalCost = agentPayments.reduce((s, p) => s + (p.status !== 'blocked_by_contract' ? p.amountUSDC : 0), 0);
  const isOverspendGoal = goal.toLowerCase().includes('demo') || goal.toLowerCase().includes('overspend') || goal.toLowerCase().includes('budget cap');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!goal.trim() || isSynthesizing) return;
    onStartAgent(goal, isOverspendGoal);
    setGoal('');
  };

  const showPipeline = agentSteps.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[760px] w-full mx-auto space-y-6 pb-[180px]">

          {/* Hero — shown when no session active */}
          {!showPipeline && !finalOutput && (
            <div className="text-center space-y-4 py-8">
              <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[28px] text-[#10B981]">smart_toy</span>
              </div>
              <div>
                <h2 className="text-[28px] font-bold text-[#F4F4F5] tracking-tight">
                  Autonomous Service Buyer
                </h2>
                <p className="text-[15px] text-[#A1A1AA] mt-2 max-w-lg mx-auto">
                  The agent autonomously discovers services, negotiates via x402 HTTP 402, pays through
                  the smart contract escrow, and verifies delivery on-chain.
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {[
                  { icon: 'shield', text: 'Hard budget cap via smart contract' },
                  { icon: 'payments', text: 'x402 HTTP 402 payment flow' },
                  { icon: 'verified', text: 'On-chain delivery proof' },
                  { icon: 'block', text: 'Overspend = EVM REVERT' },
                ].map((f) => (
                  <div key={f.text} className="flex items-center gap-1.5 bg-[#27272A] border border-[#3F3F46] px-3 py-1.5 rounded-full text-[12px] text-[#D4D4D8]">
                    <span className="material-symbols-outlined text-[14px] text-[#10B981]">{f.icon}</span>
                    {f.text}
                  </div>
                ))}
              </div>

              {/* Goal suggestions */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {GOAL_SUGGESTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setGoal(s.query)}
                    className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-colors cursor-pointer ${
                      s.id === 'g4'
                        ? 'border-[#EF4444]/40 bg-[#EF4444]/5 text-[#EF4444] hover:bg-[#EF4444]/10'
                        : 'border-[#3F3F46] bg-[#27272A] text-[#D4D4D8] hover:bg-[#3F3F46]'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline panel */}
          {showPipeline && (
            <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
              <button
                onClick={() => setIsPipelineOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#27272A] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[16px] text-[#A1A1AA]">account_tree</span>
                  <span className="font-bold text-[13px] text-[#D4D4D8]">Agent Pipeline</span>
                  <div className="flex items-center gap-1">
                    {agentSteps.map((s) => (
                      <span key={s.id} className={`w-1.5 h-1.5 rounded-full transition-all ${
                        s.status === 'done'    ? 'bg-[#10B981]' :
                        s.status === 'running' ? 'bg-[#34D399] animate-pulse' :
                        s.status === 'blocked' ? 'bg-[#EF4444]' :
                        s.status === 'error'   ? 'bg-[#F59E0B]' : 'bg-[#3F3F46]'
                      }`} />
                    ))}
                  </div>
                  {isSynthesizing && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#34D399] bg-[#10B981]/10 px-2 py-0.5 rounded">
                      Running
                    </span>
                  )}
                  {agentStatus === 'halted_by_contract' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded animate-pulse">
                      BLOCKED
                    </span>
                  )}
                  {agentStatus === 'completed' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] bg-[#27272A] px-2 py-0.5 rounded">
                      Complete
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {totalCost > 0 && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-[#A1A1AA] bg-[#27272A] px-2 py-0.5 rounded">
                      <span className="material-symbols-outlined text-[14px]">payments</span>
                      ${totalCost.toFixed(4)} USDC
                    </div>
                  )}
                  <span className={`material-symbols-outlined text-[18px] text-[#52525B] transition-transform ${isPipelineOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>
              </button>

              {isPipelineOpen && (
                <div className="border-t border-[#27272A] divide-y divide-[#27272A]">
                  {agentSteps.map((step, idx) => {
                    const payment = agentPayments.find(p => p.idempotencyKey?.includes(String(idx)));
                    return (
                      <div key={step.id} className="flex items-start gap-3 px-4 py-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 mt-0.5 ${
                          step.status === 'done'    ? 'bg-[#10B981]/10 border-[#10B981] text-[#10B981]' :
                          step.status === 'running' ? 'bg-[#34D399]/10 border-[#34D399] text-[#34D399] animate-pulse' :
                          step.status === 'blocked' ? 'bg-[#EF4444]/10 border-[#EF4444] text-[#EF4444]' :
                          step.status === 'error'   ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-[#F59E0B]' :
                                                      'bg-[#18181B] border-[#3F3F46] text-[#A1A1AA]'
                        }`}>
                          {step.status === 'done'    ? <span className="material-symbols-outlined text-[12px]">check</span> :
                           step.status === 'blocked' ? <span className="material-symbols-outlined text-[12px]">block</span> :
                           step.status === 'error'   ? <span className="material-symbols-outlined text-[12px]">close</span> :
                           step.status === 'running' ? <span className="material-symbols-outlined text-[12px] animate-spin">autorenew</span> :
                                                       String(idx + 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[13px] text-[#D4D4D8]">{step.name}</span>
                            <span className="text-[10px] text-[#A1A1AA] bg-[#27272A] px-1.5 py-0.5 rounded font-mono">{step.capability}</span>
                            <span className="text-[10px] text-[#52525B]">via {step.provider}</span>
                          </div>
                          {step.status === 'blocked' && step.error && (
                            <p className="text-[11px] text-[#EF4444] mt-1 font-mono">{step.error}</p>
                          )}
                          {payment?.deliveryHash && (
                            <p className="text-[10px] text-[#52525B] font-mono mt-1 truncate">
                              delivery: {payment.deliveryHash}
                            </p>
                          )}
                        </div>
                        {payment && (
                          <div className="text-right shrink-0">
                            <span className={`text-[11px] font-mono font-bold ${
                              payment.status === 'blocked_by_contract' ? 'text-[#EF4444]' : 'text-[#10B981]'
                            }`}>
                              {payment.status === 'blocked_by_contract' ? '🚫' : '✓'} ${payment.amountUSDC.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Block explanation */}
          {agentStatus === 'halted_by_contract' && haltReason && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#EF4444] fill-1">block</span>
                <span className="font-bold text-[14px] text-[#EF4444]">Contract Revert — Enforcement Active</span>
              </div>
              <p className="text-[13px] text-[#D4D4D8] font-mono bg-[#09090B] p-3 rounded-lg border border-[#EF4444]/20">
                {haltReason}
              </p>
              <p className="text-[12px] text-[#A1A1AA]">
                ✅ The agent was <strong className="text-[#F4F4F5]">physically blocked</strong> by the blockchain consensus layer.
                This is NOT the agent voluntarily declining — the smart contract reverted the EVM transaction.
              </p>
            </div>
          )}

          {/* Final output */}
          {finalOutput && agentStatus === 'completed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#A1A1AA] text-[11px] font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                Agent Output
              </div>
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
                <div className="prose prose-invert max-w-none text-[15px] leading-[24px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalOutput}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isSynthesizing && (
            <div className="flex items-center gap-3 py-2 text-[#A1A1AA]">
              <div className="flex space-x-1">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-2 h-2 bg-[#A1A1AA] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <span className="text-[13px]">Agent is working…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating composer */}
      <div className="flex-shrink-0 p-4 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent">
        <form onSubmit={handleSubmit} className="max-w-[760px] mx-auto bg-[#27272A] rounded-2xl border border-[#3F3F46] p-3 shadow-2xl">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isSynthesizing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="Give the agent a goal (e.g. translate, store, compute)…"
            className="w-full bg-transparent border-none focus:outline-none resize-none min-h-[56px] max-h-[180px] p-2 text-[15px] text-[#F4F4F5] placeholder:text-[#52525B] font-sans"
          />
          <div className="flex items-center justify-between px-2 pt-1 border-t border-[#3F3F46]">
            <div className="flex items-center gap-2">
              {isOverspendGoal && (
                <span className="text-[11px] text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-2 py-0.5 rounded font-medium">
                  ⚠️ Overspend demo mode
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!goal.trim() || isSynthesizing}
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                goal.trim() && !isSynthesizing
                  ? 'bg-[#F4F4F5] text-[#18181B] hover:bg-[#D4D4D8] cursor-pointer'
                  : 'bg-[#3F3F46] text-[#A1A1AA] cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
