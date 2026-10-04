import React, { useState, useEffect } from 'react';
import type {
  AdminStats,
  KycSubmission,
  DepositRequest,
  DepositAccount,
  Dispute,
  User,
  AuditLog,
} from '../types';
import { apiRequest } from '../services/api';
import {
  ShieldAlert,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Building2,
  FileText,
  RefreshCw,
  Search,
  Eye,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeTab, setActiveTab] = useState<'kyc' | 'deposits' | 'accounts' | 'disputes' | 'users' | 'audit'>('kyc');

  const [kycList, setKycList] = useState<KycSubmission[]>([]);
  const [depositList, setDepositList] = useState<DepositRequest[]>([]);
  const [accounts, setAccounts] = useState<DepositAccount[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // New Account Form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accAsset, setAccAsset] = useState('ETB');
  const [accProvider, setAccProvider] = useState('Telebirr');
  const [accNumber, setAccNumber] = useState('0911002233');
  const [accName, setAccName] = useState('ETHIO EXCHANGE OFFICIAL');
  const [accMin, setAccMin] = useState('100');
  const [accMax, setAccMax] = useState('100000');

  useEffect(() => {
    fetchStats();
    fetchTabData();
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      const data = await apiRequest<AdminStats>('/admin/stats');
      setStats(data);
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'kyc') {
        const data = await apiRequest<KycSubmission[]>('/admin/kyc');
        setKycList(data);
      } else if (activeTab === 'deposits') {
        const data = await apiRequest<DepositRequest[]>('/admin/deposits');
        setDepositList(data);
      } else if (activeTab === 'accounts') {
        const data = await apiRequest<DepositAccount[]>('/admin/deposit-accounts');
        setAccounts(data);
      } else if (activeTab === 'disputes') {
        const data = await apiRequest<Dispute[]>('/admin/disputes');
        setDisputes(data);
      } else if (activeTab === 'users') {
        const data = await apiRequest<User[]>('/admin/users');
        setUsers(data);
      } else if (activeTab === 'audit') {
        const data = await apiRequest<AuditLog[]>('/admin/audit-logs');
        setAuditLogs(data);
      }
    } catch (e) {
      console.error('Failed to load tab data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewKyc = async (id: string, action: 'APPROVE' | 'REJECT') => {
    const reason = action === 'REJECT' ? prompt('Enter rejection reason:') || 'Invalid documents' : undefined;
    try {
      await apiRequest(`/admin/kyc/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectReason: reason }),
      });
      setActionSuccess(`KYC submission ${action}D`);
      fetchTabData();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleReviewDeposit = async (id: string, action: 'APPROVE' | 'REJECT') => {
    const reason = action === 'REJECT' ? prompt('Enter rejection reason:') || 'Proof invalid' : undefined;
    try {
      await apiRequest(`/admin/deposits/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectReason: reason }),
      });
      setActionSuccess(`Deposit request ${action}D`);
      fetchTabData();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleSettleDispute = async (id: string, resolution: 'RELEASE_TO_BUYER' | 'REFUND_TO_SELLER') => {
    if (!window.confirm(`Settle dispute as ${resolution}?`)) return;
    try {
      await apiRequest(`/admin/disputes/${id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      setActionSuccess(`Dispute settled: ${resolution}`);
      fetchTabData();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Settlement failed');
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/deposit-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: accAsset,
          providerName: accProvider,
          accountNumber: accNumber,
          accountName: accName,
          minLimit: accMin,
          maxLimit: accMax,
        }),
      });
      setShowAddAccount(false);
      fetchTabData();
    } catch (err: any) {
      alert(err.message || 'Failed to add account');
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-lg text-white flex items-center gap-1.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" /> Admin Control Portal
          </h2>
          <p className="text-xs text-slate-400">ETHIO EXCHANGE System Oversight</p>
        </div>

        <button
          onClick={() => {
            fetchStats();
            fetchTabData();
          }}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)}>✕</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pending KYC</span>
          <span className="text-xl font-black text-amber-400">{stats?.pendingKyc || 0}</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pending Deposits</span>
          <span className="text-xl font-black text-emerald-400">{stats?.pendingDeposits || 0}</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Open Disputes</span>
          <span className="text-xl font-black text-rose-400">{stats?.openDisputes || 0}</span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Users</span>
          <span className="text-xl font-black text-white">{stats?.totalUsers || 0}</span>
        </div>
      </div>

      {/* Admin Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'kyc', label: `Pending KYC (${stats?.pendingKyc || 0})` },
          { id: 'deposits', label: `Deposits (${stats?.pendingDeposits || 0})` },
          { id: 'disputes', label: `Disputes (${stats?.openDisputes || 0})` },
          { id: 'accounts', label: 'Deposit Accounts' },
          { id: 'users', label: 'Users' },
          { id: 'audit', label: 'Audit Logs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="text-center py-10 text-slate-500 text-xs">Loading admin records...</div>
      ) : activeTab === 'kyc' ? (
        <div className="space-y-3">
          {kycList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No pending KYC submissions</div>
          ) : (
            kycList.map((sub) => (
              <div key={sub.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-white block">{sub.fullName}</span>
                    <span className="text-[10px] text-slate-400">
                      ID: {sub.idType} ({sub.idNumber}) • Phone: {sub.phoneNumber}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sub.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : sub.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {sub.frontPhoto && (
                    <a href={sub.frontPhoto} target="_blank" rel="noreferrer" className="block text-emerald-400 underline font-semibold">
                      View ID Front Photo
                    </a>
                  )}
                  {sub.selfiePhoto && (
                    <a href={sub.selfiePhoto} target="_blank" rel="noreferrer" className="block text-emerald-400 underline font-semibold">
                      View Selfie Photo
                    </a>
                  )}
                </div>

                {sub.status === 'PENDING' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleReviewKyc(sub.id, 'APPROVE')}
                      className="py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      Approve KYC
                    </button>
                    <button
                      onClick={() => handleReviewKyc(sub.id, 'REJECT')}
                      className="py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs"
                    >
                      Reject KYC
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'deposits' ? (
        <div className="space-y-3">
          {depositList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No pending deposit requests</div>
          ) : (
            depositList.map((dep) => (
              <div key={dep.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-emerald-400 block">{dep.amount} {dep.asset}</span>
                    <span className="text-[10px] text-slate-400">
                      Via {dep.providerName} • Ref: {dep.refNumber || 'N/A'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      dep.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : dep.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {dep.status}
                  </span>
                </div>

                {dep.proofPhoto && (
                  <a href={dep.proofPhoto} target="_blank" rel="noreferrer" className="block text-xs text-emerald-400 underline font-bold">
                    View Payment Receipt Screenshot
                  </a>
                )}

                {dep.status === 'PENDING' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleReviewDeposit(dep.id, 'APPROVE')}
                      className="py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      Approve & Credit Wallet
                    </button>
                    <button
                      onClick={() => handleReviewDeposit(dep.id, 'REJECT')}
                      className="py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs"
                    >
                      Reject Deposit
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'disputes' ? (
        <div className="space-y-3">
          {disputes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No active disputes</div>
          ) : (
            disputes.map((dis) => (
              <div key={dis.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-rose-400">Reason: {dis.reason}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                    {dis.status}
                  </span>
                </div>

                {dis.status === 'OPEN' && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleSettleDispute(dis.id, 'RELEASE_TO_BUYER')}
                      className="py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      Release to Buyer
                    </button>
                    <button
                      onClick={() => handleSettleDispute(dis.id, 'REFUND_TO_SELLER')}
                      className="py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs"
                    >
                      Refund to Seller
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'accounts' ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowAddAccount(true)}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add Dynamic Payment Account
          </button>

          {accounts.map((acc) => (
            <div key={acc.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
              <div className="flex items-center justify-between font-bold text-emerald-400">
                <span>{acc.providerName} ({acc.asset})</span>
                <span>{acc.active ? 'ACTIVE' : 'DISABLED'}</span>
              </div>
              <p className="font-mono text-white">{acc.accountNumber}</p>
              <p className="text-slate-400">{acc.accountName}</p>
            </div>
          ))}

          {showAddAccount && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-bold text-sm text-white">Add Deposit Payment Account</h3>
                  <button onClick={() => setShowAddAccount(false)} className="text-slate-400">✕</button>
                </div>
                <form onSubmit={handleCreateAccountSubmit} className="space-y-2 text-xs">
                  <input
                    type="text"
                    placeholder="Provider Name (e.g. CBE Bank, Telebirr, TRC20)"
                    value={accProvider}
                    onChange={(e) => setAccProvider(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Account Number / Wallet Address"
                    value={accNumber}
                    onChange={(e) => setAccNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Account Holder Name"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                    required
                  />
                  <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                    Save Account
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'users' ? (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white block">{u.firstName || u.username || 'User'}</span>
                <span className="text-[10px] text-slate-400">TG ID: {u.telegramId} • KYC: {u.kycStatus}</span>
              </div>
              <span className="font-extrabold text-emerald-400">{u.role}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {auditLogs.map((log) => (
            <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-400">
                <span>{log.action}</span>
                <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">{log.details}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
