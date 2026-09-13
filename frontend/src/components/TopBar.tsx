import React from 'react';
import type { ActiveTab, BudgetState } from '../types';

interface TopBarProps {
  activeTab: ActiveTab;
  budget: BudgetState;
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<ActiveTab, string> = {
  'dashboard':  'Owner Dashboard',
  'run-agent':  'Run AI Agent',
  'audit':      'Payment Audit Trail',
  'providers':  'Service Providers',
  'history':    'Session History',
  'settings':   'Settings',
};

export const TopBar: React.FC<TopBarProps> = ({ activeTab, budget, onOpenMobileMenu }) => {
  const pct = budget.capUSDC > 0 ? (budget.spentUSDC / budget.capUSDC) * 100 : 0;
  const barColor = budget.isAgentBlocked ? '#EF4444' : pct > 80 ? '#F59E0B' : '#10B981';

  return (
    <header className="sticky top-0 z-10 h-14 bg-[#18181B] border-b border-[#27272A] flex items-center px-4 gap-4 shrink-0">
      {/* Mobile menu */}
      <button onClick={onOpenMobileMenu} className="md:hidden p-2 text-[#A1A1AA] hover:text-[#F4F4F5] rounded-lg hover:bg-[#27272A]">
        <span className="material-symbols-outlined">menu</span>
      </button>

      <h2 className="text-[14px] font-bold text-[#F4F4F5] truncate min-w-0">{TAB_TITLES[activeTab]}</h2>

      <div className="ml-auto flex items-center gap-3 shrink-0">
        {/* Inline budget mini-bar */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono font-bold text-[#F4F4F5]">
                ${budget.spentUSDC.toFixed(4)}
              </span>
              <span className="text-[10px] text-[#A1A1AA]">/</span>
              <span className="text-[11px] font-mono text-[#A1A1AA]">
                ${budget.capUSDC.toFixed(2)}
              </span>
              <span className="text-[10px] text-[#A1A1AA]">USDC</span>
            </div>
            <div className="w-32 h-1 bg-[#27272A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
              />
            </div>
          </div>

          {budget.isAgentBlocked && (
            <div className="flex items-center gap-1 bg-[#EF4444]/10 border border-[#EF4444]/30 px-2 py-0.5 rounded-lg animate-pulse">
              <span className="material-symbols-outlined text-[14px] text-[#EF4444]">block</span>
              <span className="text-[11px] font-bold text-[#EF4444]">BLOCKED</span>
            </div>
          )}
        </div>

        {/* Contract link chip */}
        <a
          href={`https://sepolia.etherscan.io/address/${budget.contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-[#A1A1AA] hover:text-[#10B981] bg-[#27272A] px-2 py-1 rounded-md border border-[#3F3F46] transition-colors"
          title="View contract on Sepolia"
        >
          <span className="material-symbols-outlined text-[14px]">verified</span>
          {budget.contractAddress ? `${budget.contractAddress.slice(0, 6)}…${budget.contractAddress.slice(-4)}` : 'Contract'}
        </a>
      </div>
    </header>
  );
};
