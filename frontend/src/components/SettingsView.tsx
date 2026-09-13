import React, { useState } from 'react';
import type { BudgetState } from '../types';

interface SettingsViewProps {
  budget: BudgetState;
  onUpdateBudget: (newCap: number) => void;
  backendUrl: string;
  onUpdateBackendUrl: (url: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  budget, onUpdateBudget, backendUrl, onUpdateBackendUrl
}) => {
  const [capInput, setCapInput] = useState(String(budget.capUSDC));
  const [urlInput, setUrlInput] = useState(backendUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const cap = parseFloat(capInput);
    if (!isNaN(cap) && cap > 0) onUpdateBudget(cap);
    onUpdateBackendUrl(urlInput);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-[#A1A1AA]">settings</span>
        <h2 className="text-[16px] font-bold text-[#F4F4F5]">Settings</h2>
      </div>

      {/* Contract info */}
      <Section title="Smart Contract" icon="verified">
        <Field label="Contract Address">
          <code className="text-[#10B981] text-[12px]">{budget.contractAddress || 'Not configured'}</code>
        </Field>
        <Field label="Agent Wallet">
          <code className="text-[#D4D4D8] text-[12px]">{budget.agentAddress || 'Not configured'}</code>
        </Field>
        <Field label="Owner Wallet">
          <code className="text-[#D4D4D8] text-[12px]">{budget.ownerAddress || 'Not configured'}</code>
        </Field>
        <Field label="Network">
          <span className="text-[12px] text-[#A1A1AA]">Sepolia Testnet (EVM)</span>
        </Field>
      </Section>

      {/* Budget config */}
      <Section title="Budget Cap (Demo)" icon="account_balance">
        <p className="text-[12px] text-[#A1A1AA] mb-3">
          In production, this cap is set on-chain via <code className="text-[#10B981]">setAgentBudget()</code> by the owner.
          Here you can simulate different cap values for demo purposes.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#27272A] border border-[#3F3F46] rounded-lg px-3 py-2 gap-1.5">
            <span className="text-[#A1A1AA] text-[13px]">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={capInput}
              onChange={e => setCapInput(e.target.value)}
              className="bg-transparent text-[#F4F4F5] text-[14px] font-mono outline-none w-24"
            />
            <span className="text-[#A1A1AA] text-[12px]">USDC</span>
          </div>
          <span className="text-[12px] text-[#52525B]">Current spent: ${budget.spentUSDC.toFixed(4)}</span>
        </div>
      </Section>

      {/* Backend connection */}
      <Section title="Agent Backend" icon="cloud">
        <Field label="API URL">
          <input
            type="text"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            className="bg-[#27272A] border border-[#3F3F46] rounded-lg px-3 py-2 text-[13px] font-mono text-[#F4F4F5] outline-none focus:border-[#10B981] transition-colors w-full max-w-sm"
            placeholder="http://localhost:8000"
          />
        </Field>
        <p className="text-[11px] text-[#52525B] mt-1">
          The backend must expose <code>/api/v1/agent/run</code> (WebSocket) and <code>/api/v1/budget</code>.
        </p>
      </Section>

      {/* Architecture note */}
      <Section title="Enforcement Architecture" icon="shield">
        <div className="space-y-2 text-[12px]">
          <ArchRow label="Budget Enforcement" value="AgentBudgetEscrow.sol — EVM REVERT on overspend" accent />
          <ArchRow label="Payment Flow" value="x402 HTTP 402 → on-chain payForService() → 200 + delivery" accent />
          <ArchRow label="Double-Charge Guard" value="processedRequests[requestHash] on-chain mapping" accent />
          <ArchRow label="Delivery Proof" value="deliveryProofs[requestHash] = sha256(content) on-chain" accent />
          <ArchRow label="Agent Wallet" value="Agent never holds owner funds — all payments via escrow" />
          <ArchRow label="Idempotency Key" value="sha256(agentId + serviceUrl + nonce) as bytes32" />
        </div>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-[#09090B] px-4 py-2 rounded-lg font-bold text-[13px] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
          Save Changes
        </button>
        {saved && (
          <span className="text-[12px] text-[#10B981] flex items-center gap-1 animate-fade-in">
            <span className="material-symbols-outlined text-[14px] fill-1">check_circle</span>
            Saved!
          </span>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5">
    <div className="flex items-center gap-2 mb-4">
      <span className="material-symbols-outlined text-[16px] text-[#10B981]">{icon}</span>
      <h3 className="text-[13px] font-bold text-[#F4F4F5]">{title}</h3>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-3 flex-wrap">
    <span className="text-[12px] text-[#52525B] w-28 shrink-0">{label}</span>
    {children}
  </div>
);

const ArchRow: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="flex gap-2 items-start">
    <span className="material-symbols-outlined text-[13px] text-[#10B981] fill-1 mt-0.5 shrink-0">
      {accent ? 'lock' : 'arrow_right'}
    </span>
    <div>
      <span className="text-[#D4D4D8] font-medium">{label}: </span>
      <span className="text-[#A1A1AA]">{value}</span>
    </div>
  </div>
);
