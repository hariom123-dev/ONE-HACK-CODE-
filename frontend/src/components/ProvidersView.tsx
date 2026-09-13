import React from 'react';
import type { ServiceProvider } from '../types';

interface ProvidersViewProps {
  providers: ServiceProvider[];
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({ providers }) => {
  const byCapability = providers.reduce<Record<string, ServiceProvider[]>>((acc, p) => {
    if (!acc[p.capability]) acc[p.capability] = [];
    acc[p.capability].push(p);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-[#A1A1AA]">hub</span>
        <h2 className="text-[16px] font-bold text-[#F4F4F5]">Service Providers</h2>
        <span className="text-[12px] text-[#52525B]">— registered in agent's ServiceRegistry</span>
      </div>

      <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 text-[12px]">
        <p className="text-[#A1A1AA]">
          The agent's <code className="text-[#10B981]">ServiceRegistry</code> maintains a list of x402-compatible providers.
          For each task, the agent selects the best provider by price and quality signals.
          Each provider endpoint issues an <strong className="text-[#F4F4F5]">HTTP 402 Payment Required</strong> challenge that
          must be settled through the smart contract escrow before content is delivered.
        </p>
      </div>

      {Object.entries(byCapability).map(([capability, provs]) => (
        <div key={capability} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">{capability}</span>
            <div className="flex-1 h-px bg-[#27272A]" />
            <span className="text-[10px] text-[#52525B]">{provs.length} provider{provs.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {provs.sort((a, b) => a.priceUSDC - b.priceUSDC).map((p, idx) => (
              <div key={p.id} className={`bg-[#18181B] border rounded-xl p-4 space-y-3 transition-colors ${
                p.isActive ? 'border-[#27272A] hover:border-[#3F3F46]' : 'border-[#27272A] opacity-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.isActive ? 'bg-[#10B981]' : 'bg-[#3F3F46]'}`} />
                      <span className="font-bold text-[14px] text-[#F4F4F5]">{p.name}</span>
                      {idx === 0 && p.isActive && (
                        <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 px-1.5 py-0.5 rounded">
                          CHEAPEST
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#52525B] font-mono mt-0.5">{p.url}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[16px] font-bold font-mono text-[#10B981]">${p.priceUSDC.toFixed(4)}</p>
                    <p className="text-[10px] text-[#52525B]">per call / USDC</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px]">
                  {p.avgLatencyMs && (
                    <div className="flex items-center gap-1 text-[#A1A1AA]">
                      <span className="material-symbols-outlined text-[13px]">timer</span>
                      {p.avgLatencyMs}ms avg
                    </div>
                  )}
                  {p.successRate && (
                    <div className="flex items-center gap-1 text-[#A1A1AA]">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      {(p.successRate * 100).toFixed(0)}% success
                    </div>
                  )}
                  <div className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.isActive ? 'text-[#10B981] bg-[#10B981]/10' : 'text-[#52525B] bg-[#27272A]'
                  }`}>
                    {p.isActive ? '● ACTIVE' : '○ INACTIVE'}
                  </div>
                </div>

                {/* x402 flow badge */}
                <div className="bg-[#09090B] rounded-lg p-2.5 text-[10px] font-mono text-[#52525B] space-y-0.5">
                  <div><span className="text-[#A1A1AA]">GET</span> {p.url} <span className="text-[#F59E0B]">→ 402 Payment Required</span></div>
                  <div><span className="text-[#A1A1AA]">contract</span>.payForService(owner, {p.url.slice(-15)}, amount)</div>
                  <div><span className="text-[#A1A1AA]">POST</span> X-Payment-Proof: txHash <span className="text-[#10B981]">→ 200 + deliveryHash</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
