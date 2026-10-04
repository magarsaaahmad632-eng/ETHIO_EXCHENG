import React from 'react';
import type { User, NotificationItem } from '../types';
import { ShieldCheck, Bell, TrendingUp, UserCheck, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  notifications: NotificationItem[];
  onOpenNotifications: () => void;
  onSelectAdminTab?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, notifications, onOpenNotifications, onSelectAdminTab }) => {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const isAdmin = user?.role === 'ADMIN' || user?.telegramId === '7891606253';

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-900/20">
            🇪🇹
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-white">ETHIO EXCHANGE</span>
              {isAdmin && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">P2P Crypto Escrow Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Rate Ticker Badge */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60 text-xs text-slate-300">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-emerald-400">1 USDT = 135.5 ETB</span>
          </div>

          {/* Notifications button */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User / KYC Badge */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/50">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-200 max-w-[80px] truncate">
                {user?.firstName || 'User'}
              </p>
              <div className="flex items-center gap-1 text-[10px]">
                {user?.kycStatus === 'APPROVED' ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> Verified
                  </span>
                ) : user?.kycStatus === 'PENDING' ? (
                  <span className="text-amber-400 font-medium">Pending KYC</span>
                ) : (
                  <span className="text-slate-400 font-medium">Unverified</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
