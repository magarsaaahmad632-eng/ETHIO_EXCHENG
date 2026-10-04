import React, { useState, useEffect } from 'react';
import type { User, Wallet, NotificationItem, Advertisement } from './types';
import { apiRequest } from './services/api';
import { Header } from './components/Header';
import { Navbar, TabType } from './components/Navbar';
import { HomeView } from './views/HomeView';
import { WalletView } from './views/WalletView';
import { MarketView } from './views/MarketView';
import { OrdersView } from './views/OrdersView';
import { KycView } from './views/KycView';
import { AdminView } from './views/AdminView';
import { RefreshCw, X, ShieldAlert, UserCheck } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setLoading(true);
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }

      const initData = tg?.initData || '';

      let loginRes: any;
      if (initData) {
        loginRes = await apiRequest('/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });
      } else {
        loginRes = await apiRequest('/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testTelegramUser: {
              telegramId: '7891606253', // Default Admin ID
              firstName: 'Ethio Admin',
              username: 'ethio_admin',
            },
          }),
        });
      }

      if (loginRes.token) {
        localStorage.setItem('ethio_session_token', loginRes.token);
      }

      setUser(loginRes.user);
      setWallet(loginRes.wallet);
      fetchNotifications();
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(err.message || 'Failed to initialize app');
    } finally {
      setLoading(false);
    }
  };

  const refreshUserAndWallet = async () => {
    try {
      const data = await apiRequest<{ user: User; wallet: Wallet }>('/auth/me');
      setUser(data.user);
      setWallet(data.wallet);
    } catch (e) {
      console.error('Failed to refresh user & wallet:', e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest<NotificationItem[]>('/notifications');
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  };

  const handleSelectAdForOrder = async (ad: Advertisement) => {
    if (!user) return;
    try {
      const cryptoAmount = prompt(`Enter USDT amount to trade (Limits: ${ad.minLimit} - ${ad.maxLimit} USDT):`, ad.minLimit.toString());
      if (!cryptoAmount) return;

      const numAmount = parseFloat(cryptoAmount);
      if (isNaN(numAmount) || numAmount < ad.minLimit || numAmount > ad.maxLimit) {
        alert(`Amount must be between ${ad.minLimit} and ${ad.maxLimit} USDT`);
        return;
      }

      let methods: string[] = [];
      try {
        methods = typeof ad.paymentMethods === 'string' ? JSON.parse(ad.paymentMethods) : ad.paymentMethods;
      } catch (e) {
        methods = ['Telebirr'];
      }

      const paymentMethod = methods[0] || 'Telebirr';

      const orderRes = await apiRequest('/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adId: ad.id,
          cryptoAmount: numAmount,
          paymentMethod,
        }),
      });

      setSelectedOrderId(orderRes.order.id);
      setActiveTab('orders');
      refreshUserAndWallet();
    } catch (err: any) {
      alert(err.message || 'Failed to create order');
    }
  };

  const handleSwitchRoleForTest = async (targetAdmin: boolean) => {
    setLoading(true);
    try {
      const testUser = targetAdmin
        ? { telegramId: '7891606253', firstName: 'Ethio Admin', username: 'ethio_admin' }
        : { telegramId: '9876543210', firstName: 'Standard Trader', username: 'trader_user' };

      const loginRes = await apiRequest('/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testTelegramUser: testUser }),
      });

      localStorage.setItem('ethio_session_token', loginRes.token);
      setUser(loginRes.user);
      setWallet(loginRes.wallet);
      setActiveTab('home');
    } catch (err: any) {
      alert(err.message || 'Role switch failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 animate-spin mb-4 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-slate-950" />
        </div>
        <h1 className="font-extrabold text-lg text-white">ETHIO EXCHANGE</h1>
        <p className="text-xs text-slate-400 mt-1">Connecting to Telegram Escrow Engine...</p>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN' || user?.telegramId === '7891606253';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <Header
        user={user}
        notifications={notifications}
        onOpenNotifications={() => setShowNotificationDrawer(true)}
      />

      {/* Admin Quick Role Switcher Banner in Preview mode */}
      <div className="bg-slate-900/60 border-b border-slate-800/60 px-4 py-1.5 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-medium flex items-center gap-1">
          Role: <strong className="text-emerald-400">{user?.role}</strong> (ID: {user?.telegramId})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleSwitchRoleForTest(!isAdmin)}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold"
          >
            Switch to {isAdmin ? 'User Mode' : 'Admin Mode (7891606253)'}
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4">
        {activeTab === 'home' && (
          <HomeView user={user} wallet={wallet} onNavigate={(tab) => setActiveTab(tab as TabType)} />
        )}
        {activeTab === 'wallet' && <WalletView wallet={wallet} onRefresh={refreshUserAndWallet} />}
        {activeTab === 'market' && (
          <MarketView
            user={user}
            onSelectAdForOrder={handleSelectAdForOrder}
            onRefresh={refreshUserAndWallet}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersView
            user={user}
            selectedOrderId={selectedOrderId}
            onClearSelectedOrder={() => setSelectedOrderId(null)}
            onRefreshWallet={refreshUserAndWallet}
          />
        )}
        {activeTab === 'profile' && <KycView user={user} onRefreshUser={refreshUserAndWallet} />}
        {activeTab === 'admin' && <AdminView />}
      </main>

      <Navbar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isAdmin={isAdmin}
      />

      {/* Notifications Drawer */}
      {showNotificationDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xs bg-slate-900 border-l border-slate-800 h-full p-4 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-white">Notifications</h3>
              <button onClick={() => setShowNotificationDrawer(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-400">
                    <span>{n.title}</span>
                    <span className="text-[9px] text-slate-500">{new Date(n.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
