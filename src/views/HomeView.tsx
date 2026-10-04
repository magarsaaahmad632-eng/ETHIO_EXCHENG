import React from 'react';
import type { Wallet, User } from '../types';
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  ArrowDownLeft,
  Repeat,
  ShieldCheck,
  Zap,
  Lock,
} from 'lucide-react';

interface HomeViewProps {
  user: User | null;
  wallet: Wallet | null;
  onNavigate: (tab: 'market' | 'wallet' | 'orders' | 'profile' | 'admin') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ user, wallet, onNavigate }) => {
  const usdtBal = wallet?.balanceUsdt || 0;
  const etbBal = wallet?.balanceEtb || 0;
  const isKycVerified = user?.kycStatus === 'APPROVED';

  return (
    <div className="space-y-4 pb-20">
      {/* Brand Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 border border-slate-700/60 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🇪🇹</span>
            <div>
              <h1 className="font-extrabold text-base text-white tracking-tight">ETHIO EXCHANGE</h1>
              <p className="text-[11px] text-slate-400 font-medium">Telegram P2P Escrow Engine</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {isKycVerified ? 'Verified Account' : 'Unverified'}
          </span>
        </div>

        {/* Dual Balance Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              ETB Balance
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white">{etbBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              <span className="text-xs font-bold text-amber-400">ETB</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              USDT Balance
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white">{usdtBal.toFixed(2)}</span>
              <span className="text-xs font-bold text-emerald-400">USDT</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            onClick={() => onNavigate('market')}
            className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-950/40 transition-all"
          >
            <ShoppingCart className="w-4 h-4" /> 🛒 BUY USDT
          </button>

          <button
            onClick={() => onNavigate('market')}
            className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs shadow-lg shadow-rose-950/40 transition-all"
          >
            <DollarSign className="w-4 h-4" /> 💸 SELL USDT
          </button>

          <button
            onClick={() => onNavigate('wallet')}
            className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700 transition-all"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> 💰 DEPOSIT
          </button>

          <button
            onClick={() => onNavigate('market')}
            className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700 transition-all"
          >
            <Repeat className="w-4 h-4 text-amber-400" /> 🔄 EXCHANGE
          </button>
        </div>
      </div>

      {/* Live Market Rate Ticker */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-xs font-bold text-slate-200">Official Rate</span>
            <span className="text-[10px] text-slate-400 block">Telebirr & CBE P2P Avg</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm font-extrabold text-emerald-400">1 USDT = 135.50 ETB</span>
          <span className="text-[10px] text-slate-400 block">Updated live</span>
        </div>
      </div>

      {/* Trust & Features Banner */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <Lock className="w-5 h-5 text-amber-400" />
          <h4 className="font-bold text-xs text-white">Instant Escrow</h4>
          <p className="text-[10px] text-slate-400">Crypto is locked securely in escrow during P2P orders.</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <Zap className="w-5 h-5 text-emerald-400" />
          <h4 className="font-bold text-xs text-white">Telebirr & CBE</h4>
          <p className="text-[10px] text-slate-400">Supports direct Ethiopian bank & mobile transfers.</p>
        </div>
      </div>
    </div>
  );
};
