import React, { useState, useEffect } from 'react';
import type { Wallet, LedgerTransaction, DepositAccount } from '../types';
import { apiRequest, apiFormRequest } from '../services/api';
import {
  Wallet as WalletIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Lock,
  CheckCircle2,
  Copy,
  Upload,
  AlertCircle,
  RefreshCw,
  Building2,
} from 'lucide-react';

interface WalletViewProps {
  wallet: Wallet | null;
  onRefresh: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ wallet, onRefresh }) => {
  const [history, setHistory] = useState<LedgerTransaction[]>([]);
  const [depositAccounts, setDepositAccounts] = useState<DepositAccount[]>([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<DepositAccount | null>(null);

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState('');
  const [depositRef, setDepositRef] = useState('');
  const [depositProofFile, setDepositProofFile] = useState<File | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);

  // Withdraw Form State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchDepositAccounts();
  }, []);

  const fetchHistory = async () => {
    try {
      const data = await apiRequest<LedgerTransaction[]>('/wallet/history');
      setHistory(data);
    } catch (e) {
      console.error('Failed to load wallet history:', e);
    }
  };

  const fetchDepositAccounts = async () => {
    try {
      const data = await apiRequest<DepositAccount[]>('/deposits/accounts');
      setDepositAccounts(data);
      if (data.length > 0) setSelectedAccount(data[0]);
    } catch (e) {
      console.error('Failed to load deposit accounts:', e);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);
    setDepositSuccess(null);

    if (!selectedAccount) {
      setDepositError('Please select a payment account');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setDepositError('Please enter a valid deposit amount');
      return;
    }

    setDepositLoading(true);

    try {
      const formData = new FormData();
      formData.append('asset', selectedAccount.asset);
      formData.append('providerName', selectedAccount.providerName);
      formData.append('amount', depositAmount);
      formData.append('depositAccountId', selectedAccount.id);
      if (depositRef) formData.append('refNumber', depositRef);
      if (depositProofFile) formData.append('proofPhoto', depositProofFile);

      await apiFormRequest('/deposits/request', formData);

      setDepositSuccess('Deposit request submitted! Admin will verify and credit your wallet.');
      setDepositAmount('');
      setDepositRef('');
      setDepositProofFile(null);
      onRefresh();
      fetchHistory();
      setTimeout(() => setShowDepositModal(false), 2500);
    } catch (err: any) {
      setDepositError(err.message || 'Deposit submission failed');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount');
      return;
    }

    if (!withdrawAddress || withdrawAddress.trim().length < 10) {
      setWithdrawError('Please enter a valid USDT wallet destination address');
      return;
    }

    setWithdrawLoading(true);

    try {
      await apiRequest('/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: withdrawAmount,
          destinationAddress: withdrawAddress,
        }),
      });

      setWithdrawSuccess('Withdrawal request submitted for processing.');
      setWithdrawAmount('');
      setWithdrawAddress('');
      onRefresh();
      fetchHistory();
      setTimeout(() => setShowWithdrawModal(false), 2500);
    } catch (err: any) {
      setWithdrawError(err.message || 'Withdrawal failed');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const availableUsdt = wallet?.availableUsdt || 0;
  const reservedUsdt = wallet?.reservedUsdt || 0;
  const totalUsdt = wallet?.balanceUsdt || 0;
  const etbValue = totalUsdt * 135.5;

  return (
    <div className="space-y-4 pb-20">
      {/* Wallet Balance Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 border border-slate-700/60 shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <WalletIcon className="w-40 h-40 text-emerald-400" />
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Wallet Balance</span>
          <button
            onClick={() => {
              onRefresh();
              fetchHistory();
            }}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tracking-tight">{totalUsdt.toFixed(2)}</span>
            <span className="text-lg font-extrabold text-emerald-400">USDT</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">
            ≈ {etbValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-4">
          <div className="border-r border-slate-800/80 pr-2">
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Available
            </div>
            <p className="text-base font-bold text-slate-100">{availableUsdt.toFixed(2)} USDT</p>
          </div>
          <div className="pl-2">
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Lock className="w-3 h-3 text-amber-400" /> Escrow Reserved
            </div>
            <p className="text-base font-bold text-amber-400">{reservedUsdt.toFixed(2)} USDT</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-950/40 transition-all"
          >
            <ArrowDownLeft className="w-4 h-4" /> Deposit
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700 transition-all"
          >
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
        </div>
      </div>

      {/* Ledger Transaction History */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center justify-between">
          <span>Immutable Ledger Activity</span>
          <span className="text-[10px] font-normal text-slate-400">Double-Entry Verified</span>
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No transactions recorded yet</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {history.map((tx) => {
              const isPositive = ['DEPOSIT', 'ESCROW_REFUND'].includes(tx.type);
              return (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {tx.type === 'DEPOSIT' && <ArrowDownLeft className="w-4 h-4" />}
                      {tx.type === 'WITHDRAWAL' && <ArrowUpRight className="w-4 h-4" />}
                      {tx.type === 'ESCROW_LOCK' && <Lock className="w-4 h-4 text-amber-400" />}
                      {tx.type === 'ESCROW_RELEASE' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {tx.type === 'ESCROW_REFUND' && <ArrowDownLeft className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">{tx.description}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xs font-extrabold ${
                        isPositive ? 'text-emerald-400' : tx.type === 'ESCROW_LOCK' ? 'text-amber-400' : 'text-slate-300'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {tx.amount.toFixed(2)} USDT
                    </p>
                    <p className="text-[10px] text-slate-500">Bal: {tx.balanceAfter.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white">Deposit ETB / USDT</h3>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {depositSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
                {depositSuccess}
              </div>
            )}

            {depositError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-medium">
                {depositError}
              </div>
            )}

            {/* Account Selector */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Select Payment Account</label>
              <div className="space-y-2">
                {depositAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccount(acc)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedAccount?.id === acc.id
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-emerald-400 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> {acc.providerName} ({acc.asset})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Limits: {acc.minLimit} - {acc.maxLimit}
                      </span>
                    </div>
                    <p className="text-xs font-mono font-semibold text-slate-200 mt-1">{acc.accountNumber}</p>
                    <p className="text-[11px] text-slate-400">{acc.accountName}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedAccount && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Account Number:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-white">{selectedAccount.accountNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedAccount.accountNumber, selectedAccount.id)}
                      className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {copiedId === selectedAccount.id && (
                      <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>
                    )}
                  </div>
                </div>
                {selectedAccount.instructions && (
                  <p className="text-[11px] text-amber-400/90 font-medium">{selectedAccount.instructions}</p>
                )}
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Deposit Amount ({selectedAccount?.asset || 'USDT'})
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 100"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Transaction Reference / ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN987654321"
                  value={depositRef}
                  onChange={(e) => setDepositRef(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Upload Payment Screenshot / Receipt Proof
                </label>
                <div className="relative border-2 border-dashed border-slate-800 rounded-xl p-3 text-center bg-slate-950/50 hover:border-slate-700 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setDepositProofFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <span className="text-xs font-medium text-slate-300 block">
                    {depositProofFile ? depositProofFile.name : 'Click or drop payment proof screenshot'}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={depositLoading}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                {depositLoading ? 'Submitting...' : 'Confirm & Submit Deposit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white">Withdraw USDT</h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {withdrawSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
                {withdrawSuccess}
              </div>
            )}

            {withdrawError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-medium">
                {withdrawError}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <p className="text-slate-400">
                Available to Withdraw: <span className="font-bold text-emerald-400">{availableUsdt.toFixed(2)} USDT</span>
              </p>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Withdrawal Amount (USDT)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 50"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-semibold text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Destination USDT Wallet Address (TRC20 / BEP20)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TYu89... or 0x71..."
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={withdrawLoading}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                {withdrawLoading ? 'Processing...' : 'Submit Withdrawal Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
