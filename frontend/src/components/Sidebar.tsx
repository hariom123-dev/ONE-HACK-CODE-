import React from 'react';
import type { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  pendingBlock?: boolean; // glowing red when agent is blocked
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'dashboard',   label: 'Dashboard',       icon: 'dashboard'          },
  { id: 'run-agent',   label: 'Run Agent',        icon: 'smart_toy'          },
  { id: 'audit',       label: 'Audit Trail',      icon: 'receipt_long'       },
  { id: 'providers',   label: 'Providers',        icon: 'hub'                },
  { id: 'history',     label: 'History',          icon: 'history'            },
  { id: 'settings',    label: 'Settings',         icon: 'settings'           },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, isOpenMobile, setIsOpenMobile, pendingBlock
}) => {
  const content = (
    <div className="flex flex-col h-full bg-[#18181B] text-[#F4F4F5]">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 mx-2 mt-2">
        <div className="w-8 h-8 rounded-lg bg-[#10B981] flex items-center justify-center text-[#09090B] shrink-0">
          <span className="material-symbols-outlined text-[18px] fill-1">account_balance_wallet</span>
        </div>
        <div>
          <h1 className="text-[14px] font-bold tracking-tight text-[#F4F4F5]">AgentPay</h1>
          <p className="text-[10px] text-[#A1A1AA] font-medium tracking-wider uppercase">W3A-1 · x402</p>
        </div>
      </div>

      <div className="h-px bg-[#27272A] mx-4 mt-2" />

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 p-2 mt-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const isRunAgent = item.id === 'run-agent';
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsOpenMobile(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left w-full outline-none text-[13px] font-medium relative ${
                isActive
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-[#F4F4F5]'
              } ${isRunAgent && pendingBlock ? 'ring-1 ring-[#EF4444]/50' : ''}`}
            >
              <span className={`material-symbols-outlined text-[18px] ${isActive ? 'fill-1' : ''}`}>
                {item.icon}
              </span>
              {item.label}
              {isRunAgent && pendingBlock && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom badge */}
      <div className="p-4 pt-0">
        <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-3 text-[11px]">
          <p className="text-[#A1A1AA] font-medium">Enforcement Layer</p>
          <p className="text-[#10B981] font-mono font-bold mt-0.5 truncate text-[10px]">AgentBudgetEscrow.sol</p>
          <p className="text-[#52525B] mt-1">Sepolia Testnet</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="bg-[#18181B] w-[240px] h-screen sticky left-0 top-0 border-r border-[#27272A] hidden md:flex flex-col shrink-0 z-20">
        {content}
      </aside>

      {/* Mobile overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpenMobile(false)} />
          <aside className="relative w-[240px] h-full bg-[#18181B] border-r border-[#27272A] flex flex-col z-10 shadow-2xl">
            <button onClick={() => setIsOpenMobile(false)} className="absolute top-4 right-4 p-1 text-[#A1A1AA] hover:text-[#F4F4F5] rounded-full">
              <span className="material-symbols-outlined">close</span>
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
