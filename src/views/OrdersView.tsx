import React, { useState, useEffect } from 'react';
import type { Order, User, Dispute } from '../types';
import { apiRequest, apiFormRequest } from '../services/api';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Lock,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

interface OrdersViewProps {
  user: User | null;
  selectedOrderId: string | null;
  onClearSelectedOrder: () => void;
  onRefreshWallet: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  user,
  selectedOrderId,
  onClearSelectedOrder,
  onRefreshWallet,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REJECTED'>('ALL');
  const [loading, setLoading] = useState(false);

  // Payment Proof Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Dispute Modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('Payment sent via Telebirr but seller hasn\'t released crypto');
  const [disputeMsg, setDisputeMsg] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  // Action status state
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      fetchSingleOrder(selectedOrderId);
    }
  }, [selectedOrderId]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Order[]>('/orders/my');
      setOrders(data);
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleOrder = async (orderId: string) => {
    try {
      const data = await apiRequest<Order>(`/orders/${orderId}`);
      setActiveOrder(data);
    } catch (e) {
      console.error('Failed to fetch order details:', e);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setPayError(null);
    setPayLoading(true);

    try {
      const formData = new FormData();
      if (paymentRef) formData.append('paymentRef', paymentRef);
      if (proofFile) formData.append('proofPhoto', proofFile);

      await apiFormRequest(`/orders/${activeOrder.id}/pay`, formData);

      setActionSuccess('Order marked as PAID! Seller notified to release crypto.');
      setShowPayModal(false);
      fetchSingleOrder(activeOrder.id);
      fetchOrders();
    } catch (err: any) {
      setPayError(err.message || 'Failed to submit payment proof');
    } finally {
      setPayLoading(false);
    }
  };

  const handleReleaseCrypto = async () => {
    if (!activeOrder) return;
    if (!window.confirm(`Are you sure you want to release ${activeOrder.cryptoAmount} USDT to the buyer?`)) return;

    setLoading(true);
    try {
      await apiRequest(`/orders/${activeOrder.id}/release`, { method: 'POST' });
      setActionSuccess('Crypto released to buyer successfully!');
      fetchSingleOrder(activeOrder.id);
      fetchOrders();
      onRefreshWallet();
    } catch (err: any) {
      alert(err.message || 'Release failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setDisputeError(null);
    setDisputeLoading(true);

    try {
      await apiRequest('/disputes/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrder.id,
          reason: disputeReason,
        }),
      });

      setActionSuccess('Dispute opened successfully. Admin notified for review.');
      setShowDisputeModal(false);
      fetchSingleOrder(activeOrder.id);
      fetchOrders();
    } catch (err: any) {
      setDisputeError(err.message || 'Failed to open dispute');
    } finally {
      setDisputeLoading(false);
    }
  };

  const handlePostDisputeMsg = async () => {
    if (!activeOrder?.dispute || !disputeMsg.trim()) return;

    try {
      await apiRequest(`/disputes/${activeOrder.dispute.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: disputeMsg }),
      });

      setDisputeMsg('');
      fetchSingleOrder(activeOrder.id);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    }
  };

  const filteredOrders = orders.filter((ord) => {
    if (activeTabFilter === 'ALL') return true;
    if (activeTabFilter === 'PENDING') return ['CREATED', 'PAYMENT_PENDING'].includes(ord.status);
    if (activeTabFilter === 'ACTIVE') return ['PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED', 'RELEASE_PENDING', 'DISPUTED'].includes(ord.status);
    if (activeTabFilter === 'COMPLETED') return ord.status === 'COMPLETED';
    if (activeTabFilter === 'CANCELLED') return ord.status === 'CANCELLED' || ord.status === 'EXPIRED';
    if (activeTabFilter === 'REJECTED') return ord.status === 'REJECTED';
    return true;
  });

  if (activeOrder) {
    const isBuyer = activeOrder.buyerId === user?.id;
    const isSeller = activeOrder.sellerId === user?.id;

    return (
      <div className="space-y-4 pb-20 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setActiveOrder(null);
              onClearSelectedOrder();
            }}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
          >
            ← Back to My Orders
          </button>
          <span className="text-[10px] font-mono text-slate-500">Order #{activeOrder.id.substring(0, 8)}</span>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400">✕</button>
          </div>
        )}

        {/* Order Status Banner */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Escrow Status</span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                activeOrder.status === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : activeOrder.status === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : activeOrder.status === 'PAYMENT_SUBMITTED' || activeOrder.status === 'PAYMENT_CONFIRMED'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : activeOrder.status === 'DISPUTED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {activeOrder.status === 'COMPLETED' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> ✓ Approved / Completed
                </>
              ) : activeOrder.status === 'REJECTED' ? (
                <>
                  <XCircle className="w-3.5 h-3.5" /> ✕ Rejected
                </>
              ) : (
                activeOrder.status
              )}
            </span>
          </div>

          {activeOrder.status === 'REJECTED' && activeOrder.rejectionReason && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <strong className="block font-bold">Rejection Reason:</strong>
              {activeOrder.rejectionReason}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Crypto Amount</span>
              <span className="text-base font-extrabold text-emerald-400">{activeOrder.cryptoAmount} USDT</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">Total Fiat Amount</span>
              <span className="text-base font-extrabold text-white">{activeOrder.fiatAmount.toFixed(2)} ETB</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>Rate: 1 USDT = {activeOrder.price} ETB</span>
            <span>Payment Method: <strong className="text-slate-200">{activeOrder.paymentMethod}</strong></span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            {isBuyer && (activeOrder.status === 'CREATED' || activeOrder.status === 'PAYMENT_PENDING') && (
              <button
                onClick={() => setShowPayModal(true)}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40"
              >
                I Have Paid ({activeOrder.fiatAmount.toFixed(2)} ETB)
              </button>
            )}

            {isSeller && (activeOrder.status === 'PAYMENT_SUBMITTED' || activeOrder.status === 'PAYMENT_CONFIRMED' || activeOrder.status === 'RELEASE_PENDING' || activeOrder.status === 'DISPUTED') && (
              <button
                onClick={handleReleaseCrypto}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40"
              >
                Release Crypto ({activeOrder.cryptoAmount} USDT)
              </button>
            )}

            {activeOrder.status !== 'COMPLETED' && activeOrder.status !== 'CANCELLED' && activeOrder.status !== 'REJECTED' && !activeOrder.dispute && (
              <button
                onClick={() => setShowDisputeModal(true)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs border border-rose-500/30 flex items-center justify-center gap-1"
              >
                <ShieldAlert className="w-4 h-4" /> Open Dispute / Report Issue
              </button>
            )}
          </div>
        </div>

        {/* Dispute Chat */}
        {activeOrder.dispute && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/40 space-y-3">
            <h4 className="font-bold text-xs text-rose-400 flex items-center gap-1">
              <ShieldAlert className="w-4 h-4" /> Dispute Open (Reason: {activeOrder.dispute.reason})
            </h4>

            <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
              {activeOrder.dispute.messages?.map((msg) => (
                <div key={msg.id} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-emerald-400">{msg.sender?.firstName || msg.senderRole}:</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="p-2 rounded-lg bg-slate-900 text-slate-200">{msg.message}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type evidence message..."
                value={disputeMsg}
                onChange={(e) => setDisputeMsg(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
              />
              <button
                onClick={handlePostDisputeMsg}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Pay Modal */}
        {showPayModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-base text-white">Confirm Payment Submission</h3>
                <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">
                  ✕
                </button>
              </div>

              {payError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-medium">
                  {payError}
                </div>
              )}

              <form onSubmit={handlePaySubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Bank / Telebirr Transaction Reference Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TXN12345678"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Upload Receipt Screenshot</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 p-2 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={payLoading}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                >
                  {payLoading ? 'Submitting...' : 'Confirm I Have Paid'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-extrabold text-base text-white">Open Dispute</h3>
                <button onClick={() => setShowDisputeModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">
                  ✕
                </button>
              </div>

              {disputeError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-medium">
                  {disputeError}
                </div>
              )}

              <form onSubmit={handleOpenDispute} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Dispute Reason</label>
                  <textarea
                    rows={3}
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={disputeLoading}
                  className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-sm disabled:opacity-50"
                >
                  {disputeLoading ? 'Submitting...' : 'Submit Dispute to Admin'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-base text-white">My P2P Orders</h3>
        <button onClick={fetchOrders} className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* User Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
        {(['ALL', 'PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTabFilter(tab)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTabFilter === tab
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {tab === 'COMPLETED' ? 'Approved' : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500 text-xs">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800 p-6 space-y-2">
          <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No Orders Found</p>
          <p className="text-xs text-slate-500">Go to P2P Market to initiate a trade!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((ord) => {
            const isBuyer = ord.buyerId === user?.id;
            return (
              <div
                key={ord.id}
                onClick={() => fetchSingleOrder(ord.id)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        isBuyer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {isBuyer ? 'BUYING' : 'SELLING'}
                    </span>
                    <span className="font-bold text-xs text-slate-200">
                      {ord.cryptoAmount} USDT
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      ord.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : ord.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : ord.status === 'PAYMENT_SUBMITTED' || ord.status === 'PAYMENT_CONFIRMED'
                        ? 'bg-blue-500/20 text-blue-400'
                        : ord.status === 'DISPUTED'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {ord.status === 'COMPLETED' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </>
                    ) : ord.status === 'REJECTED' ? (
                      <>
                        <XCircle className="w-3 h-3" /> Rejected
                      </>
                    ) : (
                      ord.status
                    )}
                  </span>
                </div>

                {ord.status === 'REJECTED' && ord.rejectionReason && (
                  <p className="text-[11px] text-rose-300/90 font-medium">Reason: {ord.rejectionReason}</p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Total: <strong className="text-white">{ord.fiatAmount.toFixed(2)} ETB</strong></span>
                  <span className="text-[10px]">{new Date(ord.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
