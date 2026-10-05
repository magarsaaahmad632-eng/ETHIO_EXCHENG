import React, { useState, useEffect } from 'react';
import type {
  AdminStats,
  KycSubmission,
  DepositRequest,
  DepositAccount,
  Dispute,
  User,
  AuditLog,
  Order,
} from '../types';
import { apiRequest } from '../services/api';
import {
  ShieldAlert,
  TrendingUp,
  ShoppingBag,
  UserCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Store,
  CreditCard,
  Globe,
  Settings as SettingsIcon,
  BarChart3,
  FileText,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Lock,
} from 'lucide-react';

export type AdminPage =
  | 'dashboard'
  | 'today_rate'
  | 'p2p_orders'
  | 'p2p_approved'
  | 'p2p_rejected'
  | 'kyc_orders'
  | 'deposit_orders'
  | 'withdrawal_orders'
  | 'users'
  | 'p2p_ads'
  | 'payment_accounts'
  | 'payment_methods'
  | 'crypto_networks'
  | 'disputes'
  | 'statistics'
  | 'audit_logs'
  | 'settings';

export const AdminView: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<AdminPage>('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Today Rate State
  const [rateData, setRateLogData] = useState<{
    currentRate: number;
    previousRate: number;
    lastUpdated: string;
    updatedBy: string;
    history: any[];
  } | null>(null);
  const [newRateInput, setNewRateInput] = useState('');
  const [rateLoading, setRateLoading] = useState(false);

  // Orders State
  const [p2pFilterStatus, setP2pFilterStatus] = useState<string>('ALL');
  const [p2pOrders, setP2pOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // KYC Orders State
  const [kycFilterStatus, setKycFilterStatus] = useState<string>('ALL');
  const [kycOrders, setKycOrders] = useState<KycSubmission[]>([]);

  // Deposit Orders State
  const [depositFilterStatus, setDepositFilterStatus] = useState<string>('ALL');
  const [depositOrders, setDepositOrders] = useState<DepositRequest[]>([]);

  // Withdrawal Orders State
  const [withdrawalOrders, setWithdrawalOrders] = useState<any[]>([]);

  // Other Admin Records
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<DepositAccount[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettingsMap] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetType, setRejectTargetType] = useState<'p2p' | 'kyc' | 'deposit' | 'withdrawal' | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // Payment Account Form State
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accAsset, setAccAsset] = useState('ETB');
  const [accProvider, setAccProvider] = useState('Telebirr');
  const [accNumber, setAccNumber] = useState('0911002233');
  const [accName, setAccName] = useState('ETHIO EXCHANGE OFFICIAL');

  useEffect(() => {
    fetchStats();
    loadPageData(currentPage);
  }, [currentPage, p2pFilterStatus, kycFilterStatus, depositFilterStatus]);

  const fetchStats = async () => {
    try {
      const data = await apiRequest<AdminStats>('/admin/stats');
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch admin stats:', e);
    }
  };

  const loadPageData = async (page: AdminPage) => {
    setLoading(true);
    try {
      if (page === 'today_rate') {
        const data = await apiRequest('/admin/today-rate');
        setRateLogData(data);
        setNewRateInput(data.currentRate.toString());
      } else if (page === 'p2p_orders') {
        const data = await apiRequest<Order[]>(`/admin/p2p-orders?status=${p2pFilterStatus}`);
        setP2pOrders(data);
      } else if (page === 'p2p_approved') {
        const data = await apiRequest<Order[]>('/admin/p2p-orders/approved');
        setP2pOrders(data);
      } else if (page === 'p2p_rejected') {
        const data = await apiRequest<Order[]>('/admin/p2p-orders/rejected');
        setP2pOrders(data);
      } else if (page === 'kyc_orders') {
        const data = await apiRequest<KycSubmission[]>(`/admin/kyc-orders?status=${kycFilterStatus}`);
        setKycOrders(data);
      } else if (page === 'deposit_orders') {
        const data = await apiRequest<DepositRequest[]>(`/admin/deposit-orders?status=${depositFilterStatus}`);
        setDepositOrders(data);
      } else if (page === 'withdrawal_orders') {
        const data = await apiRequest<any[]>('/admin/withdrawal-orders');
        setWithdrawalOrders(data);
      } else if (page === 'users') {
        const data = await apiRequest<User[]>('/admin/users');
        setUsers(data);
      } else if (page === 'payment_accounts') {
        const data = await apiRequest<DepositAccount[]>('/admin/deposit-accounts');
        setAccounts(data);
      } else if (page === 'disputes') {
        const data = await apiRequest<Dispute[]>('/admin/disputes');
        setDisputes(data);
      } else if (page === 'audit_logs') {
        const data = await apiRequest<AuditLog[]>('/admin/audit-logs');
        setAuditLogs(data);
      } else if (page === 'settings') {
        const data = await apiRequest('/admin/settings');
        setSettingsMap(data);
      }
    } catch (e) {
      console.error(`Failed to load data for page ${page}:`, e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTodayRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateLoading(true);
    try {
      const res = await apiRequest('/admin/today-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate: newRateInput }),
      });
      setActionSuccess(res.message || 'Today Rate updated successfully');
      loadPageData('today_rate');
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Failed to update rate');
    } finally {
      setRateLoading(false);
    }
  };

  const handleApproveP2pOrder = async (id: string) => {
    if (!window.confirm(`Approve and settle P2P order #${id.substring(0, 8)}?`)) return;
    try {
      await apiRequest(`/admin/p2p-orders/${id}/approve`, { method: 'POST' });
      setActionSuccess(`P2P order #${id.substring(0, 8)} approved and completed!`);
      loadPageData(currentPage);
      fetchStats();
      if (selectedOrder?.id === id) setSelectedOrder(null);
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleOpenRejectModal = (type: 'p2p' | 'kyc' | 'deposit' | 'withdrawal', id: string) => {
    setRejectTargetType(type);
    setRejectTargetId(id);
    setRejectReasonInput('');
    setShowRejectModal(true);
  };

  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetId || !rejectTargetType || !rejectReasonInput.trim()) {
      alert('Rejection reason is required');
      return;
    }

    try {
      if (rejectTargetType === 'p2p') {
        await apiRequest(`/admin/p2p-orders/${rejectTargetId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReasonInput }),
        });
        setActionSuccess(`P2P order #${rejectTargetId.substring(0, 8)} REJECTED`);
      } else if (rejectTargetType === 'kyc') {
        await apiRequest(`/admin/kyc/${rejectTargetId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'REJECT', rejectReason: rejectReasonInput }),
        });
        setActionSuccess('KYC submission REJECTED');
      } else if (rejectTargetType === 'deposit') {
        await apiRequest(`/admin/deposits/${rejectTargetId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'REJECT', rejectReason: rejectReasonInput }),
        });
        setActionSuccess('Deposit request REJECTED');
      }

      setShowRejectModal(false);
      loadPageData(currentPage);
      fetchStats();
      if (selectedOrder?.id === rejectTargetId) setSelectedOrder(null);
    } catch (err: any) {
      alert(err.message || 'Rejection failed');
    }
  };

  const handleApproveKyc = async (id: string) => {
    try {
      await apiRequest(`/admin/kyc/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      setActionSuccess('KYC verification APPROVED');
      loadPageData(currentPage);
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleApproveDeposit = async (id: string) => {
    try {
      await apiRequest(`/admin/deposits/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      setActionSuccess('Deposit request APPROVED and wallet credited!');
      loadPageData(currentPage);
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    }
  };

  const handleBanUser = async (id: string, isBanned: boolean) => {
    const endpoint = isBanned ? `/admin/users/${id}/unban` : `/admin/users/${id}/ban`;
    const reason = !isBanned ? prompt('Enter ban reason:') || 'Compliance violation' : undefined;
    try {
      await apiRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      setActionSuccess(`User ${isBanned ? 'unbanned' : 'banned'} successfully`);
      loadPageData('users');
    } catch (err: any) {
      alert(err.message || 'User action failed');
    }
  };

  const navMenuItems = [
    { id: 'dashboard', label: '1. Dashboard', icon: ShieldAlert },
    { id: 'today_rate', label: '2. Change Today Rate', icon: TrendingUp },
    { id: 'p2p_orders', label: '3. P2P Orders', icon: ShoppingBag },
    { id: 'p2p_approved', label: '✓ P2P Approved', icon: CheckCircle2 },
    { id: 'p2p_rejected', label: '✕ P2P Rejected', icon: XCircle },
    { id: 'kyc_orders', label: '4. KYC Orders', icon: UserCheck },
    { id: 'deposit_orders', label: '5. Deposit Orders', icon: ArrowDownLeft },
    { id: 'withdrawal_orders', label: '6. Withdrawal Orders', icon: ArrowUpRight },
    { id: 'users', label: '7. Users', icon: Users },
    { id: 'payment_accounts', label: '8. Payment Accounts', icon: CreditCard },
    { id: 'disputes', label: '9. Disputes', icon: ShieldAlert },
    { id: 'audit_logs', label: '10. Audit Logs', icon: FileText },
    { id: 'settings', label: '11. Settings', icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4 pb-20 max-w-2xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="font-black text-lg text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" /> ADMIN CONTROL PORTAL
          </h2>
          <p className="text-xs text-slate-400">ETHIO EXCHANGE Real Management Engine</p>
        </div>
        <button
          onClick={() => {
            fetchStats();
            loadPageData(currentPage);
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

      {/* Navigation Bar Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {navMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id as AdminPage)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/40 font-black'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Page 1: DASHBOARD */}
      {currentPage === 'dashboard' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Total Users</span>
              <span className="text-2xl font-black text-white block">{stats?.totalUsers || 0}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Pending KYC</span>
              <span className="text-2xl font-black text-amber-400 block">{stats?.pendingKyc || 0}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Pending Deposits</span>
              <span className="text-2xl font-black text-emerald-400 block">{stats?.pendingDeposits || 0}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Open Disputes</span>
              <span className="text-2xl font-black text-rose-400 block">{stats?.openDisputes || 0}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Total Custody Balances</h3>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Total USDT</span>
                <span className="text-lg font-black text-emerald-400">{stats?.totalBalanceUsdt.toFixed(2)} USDT</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Total ETB</span>
                <span className="text-lg font-black text-amber-400">{stats?.totalBalanceEtb.toFixed(2)} ETB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page 2: CHANGE TODAY RATE */}
      {currentPage === 'today_rate' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-white">Change Today Rate</h3>
              <p className="text-xs text-slate-400">Controls the live exchange rate for new orders (1 USDT = XXXX ETB)</p>
            </div>
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Current Active Rate</span>
              <span className="text-xl font-black text-emerald-400">1 USDT = {rateData?.currentRate} ETB</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Previous Rate</span>
              <span className="text-lg font-bold text-slate-300">1 USDT = {rateData?.previousRate} ETB</span>
            </div>
          </div>

          <form onSubmit={handleUpdateTodayRate} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Set New Rate (ETB per 1 USDT)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 136.00"
                value={newRateInput}
                onChange={(e) => setNewRateInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-black text-base"
                required
              />
            </div>
            <p className="text-[11px] text-amber-400 font-medium">
               Note: Changing Today's Rate will NOT affect existing P2P orders. Existing orders maintain their original rate snapshot.
            </p>
            <button
              type="submit"
              disabled={rateLoading}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40"
            >
              {rateLoading ? 'Saving Rate...' : 'Save Today Rate'}
            </button>
          </form>

          {rateData?.history && rateData.history.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <h4 className="font-bold text-xs text-slate-300">Rate Change Audit Trail</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {rateData.history.map((h: any) => (
                  <div key={h.id} className="p-2 rounded-xl bg-slate-950 text-xs flex items-center justify-between border border-slate-800">
                    <span className="font-bold text-emerald-400">1 USDT = {h.rate} ETB</span>
                    <span className="text-[10px] text-slate-400">By: {h.updatedBy} • {new Date(h.updatedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Page 3: P2P ORDERS */}
      {currentPage === 'p2p_orders' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {['ALL', 'PENDING', 'PAYMENT_SUBMITTED', 'RELEASE_PENDING', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setP2pFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  p2pFilterStatus === st
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {p2pOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No P2P orders found in status {p2pFilterStatus}</div>
          ) : (
            p2pOrders.map((ord) => (
              <div key={ord.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-300">Order #{ord.id.substring(0, 8)}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      ord.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : ord.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {ord.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Buyer</span>
                    <span className="font-bold">{ord.buyer?.firstName || ord.buyerId}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Seller</span>
                    <span className="font-bold">{ord.seller?.firstName || ord.sellerId}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between font-bold text-white pt-1 border-t border-slate-800">
                  <span>{ord.cryptoAmount} USDT</span>
                  <span className="text-emerald-400">{ord.fiatAmount.toFixed(2)} ETB</span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  {ord.status !== 'COMPLETED' && ord.status !== 'REJECTED' && (
                    <button
                      onClick={() => handleApproveP2pOrder(ord.id)}
                      className="py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      Approve & Settle
                    </button>
                  )}
                  {ord.status !== 'REJECTED' && ord.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleOpenRejectModal('p2p', ord.id)}
                      className="py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs"
                    >
                      Reject Order
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Page 3.1: P2P APPROVED PAGE */}
      {currentPage === 'p2p_approved' && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            Real Filtered View: Completed / Approved P2P Orders
          </div>

          {p2pOrders.map((ord) => (
            <div key={ord.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-400">Order #{ord.id.substring(0, 8)}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  ✓ COMPLETED / APPROVED
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Buyer: {ord.buyer?.firstName}</span>
                <span>Seller: {ord.seller?.firstName}</span>
              </div>
              <div className="flex items-center justify-between font-extrabold text-white pt-1 border-t border-slate-800">
                <span>{ord.cryptoAmount} USDT</span>
                <span className="text-emerald-400">{ord.fiatAmount.toFixed(2)} ETB</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Page 3.2: P2P REJECTED PAGE */}
      {currentPage === 'p2p_rejected' && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
            Real Filtered View: Explicitly Rejected P2P Orders
          </div>

          {p2pOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No rejected P2P orders recorded</div>
          ) : (
            p2pOrders.map((ord) => (
              <div key={ord.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-rose-400">Order #{ord.id.substring(0, 8)}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400">
                    ✕ REJECTED
                  </span>
                </div>
                <p className="text-rose-300 font-medium bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                  <strong>Rejection Reason:</strong> {ord.rejectionReason || 'Declined by admin'}
                </p>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Rejected By: {ord.rejectedBy || 'Admin'}</span>
                  <span>Rejected At: {ord.rejectedAt ? new Date(ord.rejectedAt).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Page 4: KYC ORDERS */}
      {currentPage === 'kyc_orders' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setKycFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  kycFilterStatus === st ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {kycOrders.map((sub) => (
            <div key={sub.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{sub.fullName} ({sub.idType})</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    sub.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {sub.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {sub.frontPhoto && (
                  <a href={sub.frontPhoto} target="_blank" rel="noreferrer" className="block text-emerald-400 underline font-semibold">
                    View ID Front
                  </a>
                )}
                {sub.selfiePhoto && (
                  <a href={sub.selfiePhoto} target="_blank" rel="noreferrer" className="block text-emerald-400 underline font-semibold">
                    View Face Selfie
                  </a>
                )}
              </div>

              {sub.status === 'PENDING' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <button onClick={() => handleApproveKyc(sub.id)} className="py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                    Approve KYC
                  </button>
                  <button
                    onClick={() => handleOpenRejectModal('kyc', sub.id)}
                    className="py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold"
                  >
                    Reject KYC
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Page 5: DEPOSIT ORDERS */}
      {currentPage === 'deposit_orders' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setDepositFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  depositFilterStatus === st ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {depositOrders.map((dep) => (
            <div key={dep.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-400">{dep.amount} {dep.asset}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                  {dep.status}
                </span>
              </div>

              {dep.paymentAccountSnapshot && (
                <p className="text-[10px] font-mono text-slate-400 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  Snapshot: {dep.paymentAccountSnapshot}
                </p>
              )}

              {dep.status === 'PENDING' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <button onClick={() => handleApproveDeposit(dep.id)} className="py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                    Approve Deposit
                  </button>
                  <button
                    onClick={() => handleOpenRejectModal('deposit', dep.id)}
                    className="py-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold"
                  >
                    Reject Deposit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Page 7: USERS PAGE */}
      {currentPage === 'users' && (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white block">{u.firstName || u.username}</span>
                <span className="text-[10px] text-slate-400">TG ID: {u.telegramId} • Status: {u.accountStatus}</span>
              </div>
              <button
                onClick={() => handleBanUser(u.id, u.accountStatus === 'BANNED')}
                className={`px-3 py-1.5 rounded-xl font-bold ${
                  u.accountStatus === 'BANNED' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {u.accountStatus === 'BANNED' ? 'Unban User' : 'Ban User'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Page 8: PAYMENT ACCOUNTS */}
      {currentPage === 'payment_accounts' && (
        <div className="space-y-3">
          <button
            onClick={() => setShowAddAccount(true)}
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add Dynamic Payment Account
          </button>

          {accounts.map((acc) => (
            <div key={acc.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
              <div className="flex items-center justify-between font-bold text-emerald-400">
                <span>{acc.providerName} ({acc.asset})</span>
                <span>{acc.active ? 'ACTIVE' : 'DISABLED'}</span>
              </div>
              <p className="font-mono text-white">{acc.accountNumber}</p>
              <p className="text-slate-400">{acc.accountName}</p>
            </div>
          ))}
        </div>
      )}

      {/* Page 10: AUDIT LOGS */}
      {currentPage === 'audit_logs' && (
        <div className="space-y-2">
          {auditLogs.map((log) => (
            <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-400">
                <span>{log.action}</span>
                <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 mt-1">{log.details}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal with REQUIRED Rejection Reason */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-rose-400">Confirm Rejection</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleConfirmRejection} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Rejection Reason <span className="text-rose-400">* (Required)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide explicit reason for rejection..."
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-sm"
              >
                Confirm & Record Rejection
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
