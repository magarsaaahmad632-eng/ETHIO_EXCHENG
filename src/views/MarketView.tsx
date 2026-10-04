import React, { useState, useEffect } from 'react';
import type { Advertisement, User } from '../types';
import { apiRequest } from '../services/api';
import { Plus, Store, CheckCircle, ShieldCheck, ArrowRight, Wallet, AlertCircle } from 'lucide-react';

interface MarketViewProps {
  user: User | null;
  onSelectAdForOrder: (ad: Advertisement) => void;
  onRefresh: () => void;
}

export const MarketView: React.FC<MarketViewProps> = ({ user, onSelectAdForOrder, onRefresh }) => {
  const [activeType, setActiveType] = useState<'BUY' | 'SELL'>('SELL'); // 'SELL' ad means user can BUY from this ad!
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Create Ad Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adType, setAdType] = useState<'BUY' | 'SELL'>('SELL');
  const [adPrice, setAdPrice] = useState('135.5');
  const [adMinLimit, setAdMinLimit] = useState('10');
  const [adMaxLimit, setAdMaxLimit] = useState('500');
  const [adMethods, setAdMethods] = useState<string[]>(['Telebirr', 'CBE Bank']);
  const [adTerms, setAdTerms] = useState('Fast release within 5 minutes. Telebirr/CBE only.');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchAds();
  }, [activeType]);

  const fetchAds = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Advertisement[]>(`/p2p/ads?type=${activeType}`);
      setAds(data);
    } catch (e) {
      console.error('Failed to fetch P2P ads:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (adMethods.length === 0) {
      setCreateError('Please select at least one payment method');
      return;
    }

    setCreateLoading(true);

    try {
      await apiRequest('/p2p/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: adType,
          price: adPrice,
          minLimit: adMinLimit,
          maxLimit: adMaxLimit,
          paymentMethods: adMethods,
          terms: adTerms,
        }),
      });

      setShowCreateModal(false);
      fetchAds();
      onRefresh();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create advertisement');
    } finally {
      setCreateLoading(false);
    }
  };

  const paymentOptions = ['Telebirr', 'CBE Bank', 'Awash Bank', 'Dashen Bank'];

  const filteredAds = ads.filter((ad) => {
    if (selectedMethod === 'ALL') return true;
    try {
      const methods: string[] = typeof ad.paymentMethods === 'string' ? JSON.parse(ad.paymentMethods) : ad.paymentMethods;
      return methods.includes(selectedMethod);
    } catch (e) {
      return true;
    }
  });

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner & Tab Switcher */}
      <div className="flex items-center justify-between bg-slate-900 p-2 rounded-2xl border border-slate-800">
        <div className="grid grid-cols-2 gap-1 flex-1 max-w-[240px]">
          <button
            onClick={() => setActiveType('SELL')}
            className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all ${
              activeType === 'SELL'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BUY Crypto
          </button>
          <button
            onClick={() => setActiveType('BUY')}
            className={`py-2 px-3 rounded-xl font-extrabold text-xs transition-all ${
              activeType === 'BUY'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-950/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SELL Crypto
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700/80 transition-all"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Create Ad</span>
        </button>
      </div>

      {/* Payment Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {['ALL', 'Telebirr', 'CBE Bank', 'Awash Bank'].map((method) => (
          <button
            key={method}
            onClick={() => setSelectedMethod(method)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedMethod === method
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/50'
                : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {method}
          </button>
        ))}
      </div>

      {/* Ad List */}
      {loading ? (
        <div className="text-center py-10 text-slate-500 text-xs">Loading P2P Market Advertisements...</div>
      ) : filteredAds.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6 space-y-2">
          <Store className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No Advertisements Found</p>
          <p className="text-xs text-slate-500">Be the first to post a {activeType === 'SELL' ? 'SELL' : 'BUY'} ad!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-2 py-2 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
          >
            Post Advertisement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAds.map((ad) => {
            let methods: string[] = [];
            try {
              methods = typeof ad.paymentMethods === 'string' ? JSON.parse(ad.paymentMethods) : ad.paymentMethods;
            } catch (e) {
              methods = ['Telebirr'];
            }

            const sellerName = ad.user?.firstName || ad.user?.username || 'Verified Trader';
            const isVerified = ad.user?.kycStatus === 'APPROVED';

            return (
              <div
                key={ad.id}
                className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 font-extrabold text-xs flex items-center justify-center border border-slate-700">
                      {sellerName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-100">{sellerName}</span>
                        {isVerified && (
                          <span className="text-emerald-400 flex items-center text-[10px] font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <ShieldCheck className="w-3 h-3 mr-0.5" /> Verified
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">Completion: 99.8% • 15 min window</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Unit Price</span>
                    <span className="text-base font-black text-emerald-400">{ad.price.toFixed(2)} ETB</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[11px]">
                      Limits: <span className="text-slate-200 font-semibold">{ad.minLimit} - {ad.maxLimit} USDT</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {methods.map((m) => (
                        <span key={m} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectAdForOrder(ad)}
                    className={`py-2 px-4 rounded-xl font-extrabold text-xs flex items-center gap-1 transition-all ${
                      activeType === 'SELL'
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/30'
                        : 'bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-950/30'
                    }`}
                  >
                    {activeType === 'SELL' ? 'BUY USDT' : 'SELL USDT'} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Advertisement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-white">Create P2P Advertisement</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateAdSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Ad Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdType('SELL')}
                    className={`py-2 rounded-xl text-xs font-extrabold border ${
                      adType === 'SELL'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    SELL (I want to sell USDT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdType('BUY')}
                    className={`py-2 rounded-xl text-xs font-extrabold border ${
                      adType === 'BUY'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    BUY (I want to buy USDT)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Exchange Rate (ETB per 1 USDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={adPrice}
                  onChange={(e) => setAdPrice(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Min Order (USDT)</label>
                  <input
                    type="number"
                    value={adMinLimit}
                    onChange={(e) => setAdMinLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Max Order (USDT)</label>
                  <input
                    type="number"
                    value={adMaxLimit}
                    onChange={(e) => setAdMaxLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Accepted Payment Methods</label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentOptions.map((opt) => {
                    const isChecked = adMethods.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setAdMethods(adMethods.filter((m) => m !== opt));
                          } else {
                            setAdMethods([...adMethods, opt]);
                          }
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left ${
                          isChecked
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '} {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Terms / Note to Counterparty</label>
                <textarea
                  rows={2}
                  value={adTerms}
                  onChange={(e) => setAdTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              >
                {createLoading ? 'Publishing...' : 'Publish Advertisement'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
