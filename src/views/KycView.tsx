import React, { useState, useEffect } from 'react';
import type { User, CaptchaChallenge, KycSubmission } from '../types';
import { apiRequest, apiFormRequest } from '../services/api';
import { ShieldCheck, ShieldAlert, Bot, Upload, CheckCircle2, RefreshCw, Clock } from 'lucide-react';

interface KycViewProps {
  user: User | null;
  onRefreshUser: () => void;
}

export const KycView: React.FC<KycViewProps> = ({ user, onRefreshUser }) => {
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [submission, setSubmission] = useState<KycSubmission | null>(null);

  // Form State
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idType, setIdType] = useState('NATIONAL_ID');
  const [idNumber, setIdNumber] = useState('');

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchCaptcha();
    fetchKycStatus();
  }, []);

  const fetchCaptcha = async () => {
    try {
      const data = await apiRequest<CaptchaChallenge>('/kyc/captcha');
      setCaptcha(data);
    } catch (e) {
      console.error('Failed to load CAPTCHA:', e);
    }
  };

  const fetchKycStatus = async () => {
    try {
      const data = await apiRequest<{ kycStatus: string; submission: KycSubmission }>('/kyc/status');
      setSubmission(data.submission);
    } catch (e) {
      console.error('Failed to load KYC status:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!captcha) {
      setError('CAPTCHA challenge missing');
      return;
    }

    if (!captchaAnswer) {
      setError('Please answer the "I am not a robot" CAPTCHA question');
      return;
    }

    if (!frontFile || !selfieFile) {
      setError('Please upload ID Front photo and Selfie holding ID');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('challengeCode', captcha.challengeCode);
      formData.append('captchaAnswer', captchaAnswer);
      formData.append('fullName', fullName);
      formData.append('phoneNumber', phoneNumber);
      formData.append('idType', idType);
      formData.append('idNumber', idNumber);

      formData.append('frontPhoto', frontFile);
      if (backFile) formData.append('backPhoto', backFile);
      formData.append('selfiePhoto', selfieFile);

      await apiFormRequest('/kyc/submit', formData);

      setSuccess('Identity verification submitted successfully! Admin will review your documents.');
      onRefreshUser();
      fetchKycStatus();
    } catch (err: any) {
      setError(err.message || 'Verification submission failed');
      fetchCaptcha(); // Refresh CAPTCHA on error
    } finally {
      setLoading(false);
    }
  };

  const status = user?.kycStatus || 'NONE';

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto">
      {/* Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">KYC Identity Verification</span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
              status === 'APPROVED'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : status === 'PENDING'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : status === 'REJECTED'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {status === 'APPROVED' && <ShieldCheck className="w-3.5 h-3.5" />}
            {status}
          </span>
        </div>
        <p className="text-xs text-slate-300">
          In compliance with P2P security standards, user identity verification unlocks higher daily trade limits and builds trader trust.
        </p>
      </div>

      {status === 'APPROVED' ? (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="font-extrabold text-base text-white">Identity Verified</h3>
          <p className="text-xs text-slate-300">Your account is fully verified for all P2P trading operations.</p>
        </div>
      ) : status === 'PENDING' ? (
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
          <Clock className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
          <h3 className="font-extrabold text-base text-white">Verification Under Review</h3>
          <p className="text-xs text-slate-300">Your documents have been submitted and are currently being verified by an admin.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <h4 className="font-bold text-sm text-white">Submit Verification Documents</h4>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-medium">
              {success}
            </div>
          )}

          {/* Server Verified CAPTCHA Challenge */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Bot className="w-4 h-4" /> Server Verification ("I am not a robot")
              </span>
              <button type="button" onClick={fetchCaptcha} className="text-slate-400 hover:text-white text-xs">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs font-bold text-slate-200">{captcha?.question || 'Loading challenge...'}</p>
            <input
              type="text"
              placeholder="Enter answer"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Full Name (Matching ID)</label>
            <input
              type="text"
              placeholder="e.g. Abebe Bikila"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 0911223344"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">ID Document Type</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
              >
                <option value="NATIONAL_ID">National ID (Fayda)</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVERS_LICENSE">Driver's License</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">ID Number</label>
              <input
                type="text"
                placeholder="e.g. ETH-123456"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                required
              />
            </div>
          </div>

          {/* Document Uploads */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">ID Front Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 p-2 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">ID Back Photo (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 p-2 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Selfie Holding ID</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 p-2 rounded-xl"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-950/40 disabled:opacity-50"
          >
            {loading ? 'Submitting Verification...' : 'Submit Identity Verification'}
          </button>
        </form>
      )}
    </div>
  );
};
