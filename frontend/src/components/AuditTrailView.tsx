import React, { useState } from 'react';
import type { PaymentEvent } from '../types';

interface AuditTrailViewProps {
  payments: PaymentEvent[];
}

const STATUS_CONFIG: Record<PaymentEvent['status'], { label: string; color: string; bg: string; icon: string }> = {
  delivered:           { label: 'Delivered',        color: '#10B981', bg: '#10B981/10', icon: 'check_circle'   },
  paid:                { label: 'Paid',             color: '#34D399', bg: '#34D399/10', icon: 'payments'       },
  pending:             { label: 'Pending',          color: '#A1A1AA', bg: '#A1A1AA/10', icon: 'hourglass_empty'},
  blocked_by_contract: { label: 'Blocked ⬡ Contract', color: '#EF4444', bg: '#EF4444/10', icon: 'block'      },
  duplicate_skipped:   { label: 'Duplicate (Skip)', color: '#F59E0B', bg: '#F59E0B/10', icon: 'content_copy' },
  refunding:           { label: 'Refunding',        color: '#60A5FA', bg: '#60A5FA/10', icon: 'currency_exchange'},
};

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ payments }) => {
  const [selected, setSelected] = useState<PaymentEvent | null>(null);
  const [filterStatus, setFilterStatus] = useState<PaymentEvent['status'] | 'all'>('all');

  const filtered = filterStatus === 'all' ? payments : payments.filter(p => p.status === filterStatus);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 animate-fade-in">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#A1A1AA]">receipt_long</span>
          <h2 className="text-[16px] font-bold text-[#F4F4F5]">Payment Audit Trail</h2>
          <span className="text-[12px] text-[#52525B] font-mono">({payments.length} events)</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {(['all', 'delivered', 'blocked_by_contract', 'duplicate_skipped'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                filterStatus === f
                  ? 'bg-[#10B981]/10 border-[#10B981]/50 text-[#10B981]'
                  : 'border-[#3F3F46] text-[#A1A1AA] hover:border-[#52525B] hover:text-[#D4D4D8]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'delivered' ? '✅ Delivered' : f === 'blocked_by_contract' ? '🚫 Blocked' : '♻️ Duplicate'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total Delivered" value={payments.filter(p => p.status === 'delivered').length} color="#10B981" />
        <MiniStat label="Contract Reverts" value={payments.filter(p => p.status === 'blocked_by_contract').length} color="#EF4444" />
        <MiniStat label="Duplicates Skipped" value={payments.filter(p => p.status === 'duplicate_skipped').length} color="#F59E0B" />
      </div>

      {/* Table */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#27272A] text-[10px] font-bold uppercase tracking-wider text-[#52525B]">
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">TX Hash</th>
                <th className="text-left px-4 py-3">Delivery Hash</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]">
              {filtered.map((p) => {
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-[#27272A] transition-colors cursor-pointer ${
                      p.status === 'blocked_by_contract' ? 'bg-[#EF4444]/5' : ''
                    }`}
                    onClick={() => setSelected(p)}
                  >
                    <td className="px-4 py-3 font-mono text-[#52525B] whitespace-nowrap">
                      {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-[#D4D4D8]">{p.capability}</p>
                        <p className="text-[10px] text-[#52525B] truncate max-w-[140px]">{p.serviceUrl}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#A1A1AA]">{p.provider}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold whitespace-nowrap ${
                      p.status === 'blocked_by_contract' ? 'text-[#EF4444]' : 'text-[#F4F4F5]'
                    }`}>
                      {p.status === 'blocked_by_contract' ? '🚫 ' : ''}${p.amountUSDC.toFixed(4)}
                    </td>
                    <td className="px-4 py-3">
                      {p.txHash ? (
                        <a
                          href={p.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-[#10B981] hover:underline text-[10px]"
                        >
                          {p.txHash.slice(0, 10)}…
                        </a>
                      ) : (
                        <span className="text-[#3F3F46]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.deliveryHash ? (
                        <span className="font-mono text-[10px] text-[#10B981] truncate max-w-[120px] block">
                          {p.deliveryHash.slice(0, 18)}…
                        </span>
                      ) : (
                        <span className="text-[#3F3F46]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full`}
                        style={{ color: cfg.color, backgroundColor: `${cfg.color}20` }}>
                        <span className="material-symbols-outlined text-[11px] fill-1">{cfg.icon}</span>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="material-symbols-outlined text-[16px] text-[#52525B]">chevron_right</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-[#52525B]">
              <span className="material-symbols-outlined text-[32px]">receipt_long</span>
              <p className="text-[13px] mt-2">No payment events yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[16px] text-[#F4F4F5]">Payment Detail</h3>
              <button onClick={() => setSelected(null)} className="text-[#A1A1AA] hover:text-[#F4F4F5] p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-[12px]">
              {selected.status === 'blocked_by_contract' && (
                <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
                  <p className="font-bold text-[#EF4444]">⚠️ Contract REVERT</p>
                  <p className="text-[#D4D4D8] text-[11px] mt-1">
                    The agent attempted to call <code>payForService()</code> but the smart contract reverted with
                    <code className="text-[#F59E0B]"> "BudgetCapExceeded"</code>. No funds were transferred.
                  </p>
                </div>
              )}
              {selected.status === 'duplicate_skipped' && (
                <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3">
                  <p className="font-bold text-[#F59E0B]">♻️ Idempotency Protected</p>
                  <p className="text-[#D4D4D8] text-[11px] mt-1">
                    The contract's <code>processedRequests[requestHash]</code> mapping already had this request hash.
                    The transaction reverted with <code>"Already processed (idempotent)"</code>. No double-charge.
                  </p>
                </div>
              )}

              <DetailRow label="Service" value={selected.capability} />
              <DetailRow label="Provider" value={selected.provider} />
              <DetailRow label="URL" value={selected.serviceUrl} mono />
              <DetailRow label="Amount" value={`$${selected.amountUSDC.toFixed(6)} USDC`} mono accent />
              <DetailRow label="Idempotency Key" value={selected.idempotencyKey} mono />
              {selected.txHash && (
                <DetailRow label="TX Hash" value={selected.txHash} mono link={selected.explorerUrl} />
              )}
              {selected.requestHash && <DetailRow label="Request Hash" value={selected.requestHash} mono />}
              {selected.deliveryHash && (
                <DetailRow label="Delivery Hash" value={selected.deliveryHash} mono accent />
              )}
              {selected.blockNumber && <DetailRow label="Block #" value={String(selected.blockNumber)} mono />}
              <DetailRow label="Timestamp" value={new Date(selected.timestamp).toLocaleString()} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-3 flex items-center gap-3">
    <span className="text-[24px] font-bold font-mono" style={{ color }}>{value}</span>
    <span className="text-[11px] text-[#A1A1AA]">{label}</span>
  </div>
);

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean; accent?: boolean; link?: string }> = ({
  label, value, mono, accent, link
}) => (
  <div className="flex gap-2">
    <span className="text-[#52525B] w-28 shrink-0">{label}</span>
    {link ? (
      <a href={link} target="_blank" rel="noopener noreferrer"
        className={`flex-1 min-w-0 break-all ${mono ? 'font-mono' : ''} text-[#10B981] hover:underline`}>
        {value}
      </a>
    ) : (
      <span className={`flex-1 min-w-0 break-all ${mono ? 'font-mono' : ''} ${accent ? 'text-[#10B981]' : 'text-[#D4D4D8]'}`}>
        {value}
      </span>
    )}
  </div>
);
