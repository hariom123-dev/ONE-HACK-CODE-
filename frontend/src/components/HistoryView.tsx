import React from 'react';
import type { AgentSession } from '../types';

interface HistoryViewProps {
  sessions: AgentSession[];
  onSelectSession: (session: AgentSession) => void;
}

const STATUS_MAP: Record<AgentSession['status'], { icon: string; color: string; label: string }> = {
  idle:               { icon: 'radio_button_unchecked', color: '#52525B', label: 'Idle'        },
  running:            { icon: 'autorenew',              color: '#34D399', label: 'Running'     },
  completed:          { icon: 'check_circle',           color: '#10B981', label: 'Completed'   },
  halted_by_contract: { icon: 'block',                  color: '#EF4444', label: 'Blocked'     },
  failed:             { icon: 'error',                  color: '#F59E0B', label: 'Failed'      },
};

export const HistoryView: React.FC<HistoryViewProps> = ({ sessions, onSelectSession }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-[#A1A1AA]">history</span>
        <h2 className="text-[16px] font-bold text-[#F4F4F5]">Session History</h2>
        <span className="text-[12px] text-[#52525B]">{sessions.length} sessions</span>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => {
          const cfg = STATUS_MAP[session.status];
          const deliveredCount = session.payments.filter(p => p.status === 'delivered').length;
          const blockedCount = session.payments.filter(p => p.status === 'blocked_by_contract').length;

          return (
            <div
              key={session.id}
              onClick={() => onSelectSession(session)}
              className={`bg-[#18181B] border rounded-xl p-4 cursor-pointer hover:border-[#3F3F46] transition-all ${
                session.status === 'halted_by_contract'
                  ? 'border-[#EF4444]/30 hover:border-[#EF4444]/50'
                  : 'border-[#27272A]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[20px] fill-1 mt-0.5 shrink-0" style={{ color: cfg.color }}>
                  {cfg.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[14px] text-[#F4F4F5] truncate">{session.goal}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: cfg.color, backgroundColor: `${cfg.color}20` }}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-[#52525B]">
                    <span>{new Date(session.startedAt).toLocaleString()}</span>
                    <span>·</span>
                    <span>{session.steps.length} steps</span>
                    <span>·</span>
                    <span className="font-mono text-[#10B981]">${session.totalCostUSDC.toFixed(4)} USDC</span>
                    {blockedCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-[#EF4444] font-bold">{blockedCount} reverts</span>
                      </>
                    )}
                    {deliveredCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-[#10B981]">{deliveredCount} delivered</span>
                      </>
                    )}
                  </div>

                  {session.status === 'halted_by_contract' && session.haltReason && (
                    <p className="mt-2 text-[11px] text-[#EF4444] font-mono bg-[#EF4444]/5 border border-[#EF4444]/20 rounded px-2 py-1 truncate">
                      {session.haltReason}
                    </p>
                  )}
                </div>
                <span className="material-symbols-outlined text-[16px] text-[#52525B] shrink-0">chevron_right</span>
              </div>

              {/* Step pills */}
              {session.steps.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#27272A]">
                  {session.steps.map((step) => (
                    <span key={step.id} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      step.status === 'done'    ? 'border-[#10B981]/30 text-[#10B981] bg-[#10B981]/5' :
                      step.status === 'blocked' ? 'border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/5' :
                                                  'border-[#3F3F46] text-[#52525B]'
                    }`}>
                      {step.capability}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center py-16 text-[#52525B]">
            <span className="material-symbols-outlined text-[40px]">history</span>
            <p className="text-[13px] mt-2">No sessions yet. Run the agent to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
