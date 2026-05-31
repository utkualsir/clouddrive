import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Eye, EyeOff, Moon, Sun, LogOut,
  Monitor, Smartphone, ShieldCheck, ShieldOff,
  Trash2, CheckCircle, Download, Copy, Loader2, CreditCard, X, Gift,
} from 'lucide-react';
import PaymentModal, { UpgradePlan } from '@/components/modals/PaymentModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { storageApi } from '@/api/storage';
import { formatFileSize } from '@/lib/utils';
import { usersApi } from '@/api/users';
import { authApi } from '@/api/auth';
import { LoginHistoryEntry } from '@/types';
import api from '@/api/axios';
import { paymentsApi } from '@/api/payments';

type Tab = 'profile' | 'security' | 'billing';

// ─── 2FA Setup Modal ──────────────────────────────────────────────────────────
function TwoFactorSetupModal({ onClose, onEnabled }: { onClose: () => void; onEnabled: () => void }) {
  const [modalStep, setModalStep] = useState(0);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi.twoFactorSetup().then(res => {
      if (res.success && res.data) {
        setQrCodeUrl(res.data.qrCodeUrl);
        setSecret(res.data.secret);
      }
    }).catch(() => toast.error('Failed to start 2FA setup'));
  }, []);

  const verify = async () => {
    if (verifyCode.length !== 6) { toast.error('Enter 6-digit code'); return; }
    setLoading(true);
    try {
      const res = await authApi.twoFactorVerifySetup(verifyCode);
      if (res.success && res.data) {
        setBackupCodes(res.data.backupCodes);
        setModalStep(3);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const downloadCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clouddrive-backup-codes.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const copyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Codes copied');
  };

  const inputClass = "w-full bg-transparent border-b border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5] pb-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none transition-colors";

  const stepsContent = [
    // Step 0 — Install app
    <div key="s0">
      <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-2">Step 1: Install an authenticator app</h3>
      <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-5 leading-relaxed">
        You'll need an authenticator app to generate one-time codes. We recommend:
      </p>
      <div className="space-y-2 mb-6">
        {[
          { name: 'Google Authenticator', desc: 'iOS & Android', href: 'https://googleauthenticator.net' },
          { name: 'Authy', desc: 'iOS, Android & Desktop', href: 'https://authy.com' },
        ].map(app => (
          <a
            key={app.name}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{app.name}</p>
              <p className="text-xs text-[#6B7280] dark:text-[#555555]">{app.desc}</p>
            </div>
            <span className="text-xs text-[#4F46E5]">Download →</span>
          </a>
        ))}
      </div>
      <button onClick={() => setModalStep(1)} className="w-full h-10 bg-[#4F46E5] text-white text-sm font-medium rounded-xl hover:bg-[#4338CA] transition-colors">
        I have an app, continue →
      </button>
    </div>,

    // Step 1 — Scan QR
    <div key="s1">
      <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-2">Step 2: Scan the QR code</h3>
      <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-5">Open your authenticator app and scan this code.</p>
      {qrCodeUrl ? (
        <div className="flex justify-center mb-4">
          <img src={qrCodeUrl} alt="2FA QR Code" className="w-44 h-44 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A]" />
        </div>
      ) : (
        <div className="flex justify-center mb-4">
          <div className="w-44 h-44 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-[#AAAAAA] animate-spin" />
          </div>
        </div>
      )}
      <p className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280] dark:text-[#555555] mb-1">Manual entry key</p>
      <p className="font-mono text-xs bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg p-3 break-all mb-5 text-[#0A0A0A] dark:text-[#F5F5F5]">
        {secret}
      </p>
      <button onClick={() => setModalStep(2)} className="w-full h-10 bg-[#4F46E5] text-white text-sm font-medium rounded-xl hover:bg-[#4338CA] transition-colors">
        I've scanned it →
      </button>
    </div>,

    // Step 2 — Verify
    <div key="s2">
      <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-2">Step 3: Enter the code</h3>
      <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-5">
        Enter the 6-digit code from your authenticator app to confirm the setup.
      </p>
      <div className="mb-6">
        <label className="block text-[10px] font-medium uppercase tracking-widest text-[#6B7280] dark:text-[#555555] mb-2">
          Verification code
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={verifyCode}
          onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={e => { if (e.key === 'Enter') verify(); }}
          placeholder="000000"
          className={`${inputClass} text-center text-2xl tracking-[0.5em] font-mono`}
          autoFocus
        />
      </div>
      <button
        onClick={verify}
        disabled={loading || verifyCode.length !== 6}
        className="w-full h-10 bg-[#4F46E5] text-white text-sm font-medium rounded-xl hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify & enable 2FA'}
      </button>
    </div>,

    // Step 3 — Backup codes
    <div key="s3">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
        <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">2FA is now enabled!</h3>
      </div>
      <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-4 leading-relaxed">
        Save these backup codes somewhere safe. Each code can only be used once if you lose access to your authenticator app.
      </p>
      <div className="bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-4 mb-4">
        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map(code => (
            <p key={code} className="font-mono text-xs text-center py-1.5 bg-white dark:bg-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-[#F5F5F5] tracking-widest">
              {code}
            </p>
          ))}
        </div>
      </div>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
        ⚠️ These codes won't be shown again. Download or copy them now.
      </p>
      <div className="flex gap-2 mb-4">
        <button onClick={downloadCodes} className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors">
          <Download className="w-3.5 h-3.5" /> Download
        </button>
        <button onClick={copyCodes} className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors">
          <Copy className="w-3.5 h-3.5" /> Copy all
        </button>
      </div>
      <button
        onClick={() => { onEnabled(); onClose(); }}
        className="w-full h-10 bg-[#4F46E5] text-white text-sm font-medium rounded-xl hover:bg-[#4338CA] transition-colors"
      >
        Finish
      </button>
    </div>,
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-[440px] bg-white dark:bg-[#141414] rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#6B7280] dark:text-[#555555] hover:bg-[#F0F0F0] dark:hover:bg-[#2A2A2A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === modalStep ? 'flex-1 bg-[#4F46E5]' : i < modalStep ? 'w-4 bg-[#4F46E5]/40' : 'w-4 bg-[#E5E5E5] dark:bg-[#2A2A2A]'
              }`}
            />
          ))}
        </div>

        {stepsContent[modalStep]}
      </div>
    </div>
  );
}

// ─── Disable 2FA Modal ─────────────────────────────────────────────────────────
function Disable2FAModal({ onClose, onDisabled }: { onClose: () => void; onDisabled: () => void }) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDisable = async () => {
    if (!password) { toast.error('Enter your password'); return; }
    setLoading(true);
    try {
      await authApi.twoFactorDisable(password);
      toast.success('2FA disabled');
      onDisabled();
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg ?? 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-[400px] bg-white dark:bg-[#141414] rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-1">Disable 2FA</h3>
        <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-5">Enter your password to confirm.</p>
        <div className="relative mb-5">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleDisable(); }}
            placeholder="Your password"
            autoFocus
            className="w-full bg-transparent border-b border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-red-500 pb-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none pr-8 transition-colors"
          />
          <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-0 bottom-2 text-[#AAAAAA]">
            {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDisable}
            disabled={loading}
            className="flex-1 h-9 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Disabling…</> : 'Disable 2FA'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:    { label: 'Free Plan',   color: '#6B6B6B' },
  '100gb': { label: '100 GB Plan', color: '#4F46E5' },
  '200gb': { label: '200 GB Plan', color: '#4F46E5' },
  '500gb': { label: '500 GB Plan', color: '#7c3aed' },
  '1tb':   { label: '1 TB Plan',   color: '#7c3aed' },
  '2tb':   { label: '2 TB Plan',   color: '#6d28d9' },
};

type BillCurrency = 'TRY' | 'USD' | 'EUR';
const BILL_SYM: Record<BillCurrency, string> = { TRY: '₺', USD: '$', EUR: '€' };

// ─── Upgrade Storage Modal ────────────────────────────────────────────────────
function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [currency, setCurrency] = useState<BillCurrency>('TRY');
  const [chosenPlan, setChosenPlan] = useState<UpgradePlan | null>(null);

  const { data: plansData } = useQuery({
    queryKey: ['payment-plans'],
    queryFn: () => paymentsApi.getPlans(),
  });
  const plans = (plansData?.data ?? []).filter(p => p.id !== 'free');

  if (chosenPlan) {
    return <PaymentModal plan={chosenPlan} currency={currency} onClose={onClose} />;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#141414] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Upgrade Storage</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-6 pt-5 pb-3">
          <div className="flex gap-1 bg-[#F0F0F0] dark:bg-[#1A1A1A] rounded-lg p-1 w-fit">
            {(['TRY', 'USD', 'EUR'] as BillCurrency[]).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  currency === c
                    ? 'bg-white dark:bg-[#2A2A2A] text-[#0A0A0A] dark:text-[#F5F5F5] shadow-sm'
                    : 'text-[#6B7280] dark:text-[#555555] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 pb-6 grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
          {plans.length === 0 ? (
            <div className="col-span-2 py-8 text-center text-xs text-[#AAAAAA] dark:text-[#555555]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" strokeWidth={1.5} />
              Loading plans…
            </div>
          ) : plans.map(plan => {
            const price = plan.prices[currency];
            const sym = BILL_SYM[currency];
            const storageLabel = plan.storageGB >= 1024 ? `${plan.storageGB / 1024} TB` : `${plan.storageGB} GB`;
            return (
              <button
                key={plan.id}
                onClick={() => setChosenPlan({ id: plan.id, name: plan.name, storageGB: plan.storageGB, prices: plan.prices })}
                className="relative text-left p-4 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-all"
              >
                {plan.badge && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1.5">{plan.badge}</p>
                )}
                <p className="text-sm font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{storageLabel}</p>
                <p className="text-xs text-[#6B6B6B] dark:text-[#888888] mt-0.5">
                  {sym}{price}<span className="text-[11px] text-[#AAAAAA] dark:text-[#555555]">/mo</span>
                </p>
                {plan.originalPrices && (
                  <p className="text-[11px] text-[#AAAAAA] line-through mt-0.5">{sym}{plan.originalPrices[currency]}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────
function BillingTab() {
  const { user } = useAuth();
  const plan = user?.plan ?? 'free';
  const planMeta = PLAN_LABELS[plan] ?? { label: plan, color: '#6B6B6B' };
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: () => storageApi.getStats(),
    enabled: !!user,
  });
  const stats = statsData?.data;

  const { data: requestsData } = useQuery({
    queryKey: ['my-payment-requests'],
    queryFn: () => paymentsApi.getMyRequests(),
    enabled: !!user,
  });
  const requests = requestsData?.data ?? [];

  const pct = stats?.percentage ?? 0;
  const barBg = pct > 95 ? '#EF4444' : pct > 80 ? '#f59e0b' : '#4F46E5';

  const sectionClass = "bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-6";
  const CURR_SYMS: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };

  return (
    <div className="space-y-4">
      {/* ── Current Plan ── */}
      <section className={sectionClass}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">Current Plan</h2>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="h-7 px-3 text-[11px] font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors"
          >
            Upgrade Storage
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: planMeta.color + '20' }}>
            <CreditCard className="w-5 h-5" style={{ color: planMeta.color }} strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{planMeta.label}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: planMeta.color + '20', color: planMeta.color }}>
                {planMeta.label.toUpperCase()}
              </span>
              {plan !== 'free' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400">
                  Active ✓
                </span>
              )}
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-0.5">
              {stats ? `${stats.storageUsedFormatted} used of ${stats.storageLimitFormatted}` : 'Loading storage…'}
            </p>
          </div>
        </div>

        {stats && (
          <div className="space-y-1.5">
            <div className="h-2 bg-[#F0F0F0] dark:bg-[#252525] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barBg }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#6B7280] dark:text-[#555555]">{stats.storageUsedFormatted} of {stats.storageLimitFormatted}</p>
              <p className="text-[11px] font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{pct}%</p>
            </div>
          </div>
        )}

        {plan === 'free' && (
          <div className="mt-4 flex items-center gap-2.5 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
            <span className="text-sm shrink-0">⬆️</span>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 flex-1">Upgrade to get more storage and premium features.</p>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="h-7 px-3 text-[11px] font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors shrink-0"
            >
              Upgrade →
            </button>
          </div>
        )}
      </section>

      {/* ── Payment History ── */}
      <section className={sectionClass}>
        <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-4">Payment History</h2>
        {requests.length === 0 ? (
          <p className="text-xs text-[#6B7280] dark:text-[#555555]">No payment history yet.</p>
        ) : (
          <div>
            {requests.map(req => {
              const sym = CURR_SYMS[req.currency] ?? '';
              const planLabel = req.type === 'UPGRADE' && req.plan
                ? `${req.plan.charAt(0).toUpperCase() + req.plan.slice(1)} Plan${req.storageGB ? ` · ${req.storageGB} GB` : ''}`
                : 'Donation';
              return (
                <div key={req.id} className="py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E] last:border-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      req.type === 'UPGRADE'
                        ? 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400'
                        : 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400'
                    }`}>
                      {req.type === 'UPGRADE' ? 'Upgrade' : 'Donation'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{planLabel}</p>
                      <p className="text-[11px] text-[#6B7280] dark:text-[#555555]">
                        {sym}{req.amount} {req.currency} · {new Date(req.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      req.status === 'PENDING'
                        ? 'bg-yellow-50 dark:bg-yellow-900/10 text-yellow-600 dark:text-yellow-400'
                        : req.status === 'APPROVED'
                        ? 'bg-green-50 dark:bg-green-900/10 text-green-600 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/10 text-red-500 dark:text-red-400'
                    }`}>
                      {req.status === 'PENDING' ? '⏳ Pending Review' : req.status === 'APPROVED' ? '✓ Approved' : '✗ Rejected'}
                    </span>
                  </div>
                  {req.status === 'REJECTED' && req.adminNote && (
                    <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400">Admin note: {req.adminNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </div>
  );
}

function ReferralSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['referral'],
    queryFn: () => usersApi.getReferral(),
  });
  const info = data?.data;
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sectionClass = "bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-6";

  if (isLoading) return (
    <section className={sectionClass}>
      <div className="animate-pulse space-y-3">
        <div className="h-3 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded w-24" />
        <div className="h-10 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded" />
      </div>
    </section>
  );

  return (
    <section className={sectionClass}>
      <div className="flex items-center gap-2 mb-5">
        <Gift className="w-4 h-4 text-[#4F46E5] dark:text-[#6366f1]" strokeWidth={1.5} />
        <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">Referral</h2>
      </div>

      <p className="text-xs text-[#6B7280] dark:text-[#888888] mb-5">
        Invite friends to CloudDrive and both of you get <span className="font-semibold text-[#4F46E5] dark:text-[#6366f1]">+5 GB</span> free storage.
      </p>

      {info && (
        <div className="space-y-4">
          {/* Big code display */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg px-4 py-3">
              <span className="font-mono text-lg font-bold tracking-[0.25em] text-[#0A0A0A] dark:text-[#F5F5F5]">
                {info.referralCode}
              </span>
            </div>
            <button
              onClick={() => copy(info.referralCode)}
              className="flex items-center gap-1.5 h-11 px-4 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B7280] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A] transition-colors shrink-0"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" strokeWidth={1.5} /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
              {copied ? 'Copied!' : 'Copy code'}
            </button>
          </div>

          {/* Link */}
          <div>
            <p className="text-[10px] font-medium text-[#6B7280] dark:text-[#555555] uppercase tracking-widest mb-1.5">Share link</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={info.referralLink}
                className="flex-1 text-xs bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg px-3 py-2 text-[#6B7280] dark:text-[#888888] outline-none truncate"
              />
              <button
                onClick={() => copy(info.referralLink)}
                className="h-8 px-3 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B7280] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A] transition-colors shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 pt-2 border-t border-[#F0F0F0] dark:border-[#1E1E1E]">
            <div className="text-center">
              <p className="text-xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{info.referralCount}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#555555]">friends invited</p>
            </div>
            <div className="w-px h-8 bg-[#E5E5E5] dark:bg-[#2A2A2A]" />
            <div className="text-center">
              <p className="text-xl font-bold text-[#4F46E5] dark:text-[#6366f1]">{info.bonusStorageGB} GB</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#555555]">bonus earned</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'profile');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);

  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled ?? false);
  const [emailNotifications, setEmailNotifications] = useState(user?.emailNotifications ?? true);
  const [savingNotif, setSavingNotif] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: () => storageApi.getStats(),
  });
  const stats = statsData?.data;

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['login-history'],
    queryFn: () => usersApi.getLoginHistory(),
    enabled: activeTab === 'security',
  });
  const loginHistory: LoginHistoryEntry[] = historyData?.data ?? [];

  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.put('/api/auth/me', { displayName: name });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success && data.data) updateUser(data.data);
      toast.success('Display name updated');
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
    onError: () => toast.error('Failed to update name'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ current, next }: { current: string; next: string }) => {
      const res = await api.put('/api/auth/password', { currentPassword: current, newPassword: next });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPwForm({ current: '', next: '', confirm: '' });
    },
    onError: (err: unknown) => {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg ?? 'Failed to change password');
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => usersApi.clearLoginHistory(),
    onSuccess: () => { toast.success('Login history cleared'); refetchHistory(); },
    onError: () => toast.error('Failed to clear history'),
  });

  const handleNameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error('Name is required'); return; }
    updateNameMutation.mutate(displayName.trim());
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.current || !pwForm.next) { toast.error('All fields required'); return; }
    if (pwForm.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    changePasswordMutation.mutate({ current: pwForm.current, next: pwForm.next });
  };

  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    try {
      await usersApi.updateEmailNotifications(emailNotifications);
      updateUser({ ...user!, emailNotifications });
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSavingNotif(false);
    }
  };

  const mimeCategories: Record<string, string> = {
    'image/': 'Images', 'application/pdf': 'PDFs', 'video/': 'Videos',
    'audio/': 'Audio', 'application/zip': 'Archives', 'application/vnd': 'Office docs',
  };
  const getCategory = (mimeType: string) => {
    for (const [prefix, label] of Object.entries(mimeCategories)) {
      if (mimeType.startsWith(prefix)) return label;
    }
    return 'Other';
  };
  const storageBreakdown = stats?.breakdown.reduce<Record<string, number>>((acc, item) => {
    const cat = getCategory(item.mimeType);
    acc[cat] = (acc[cat] ?? 0) + parseInt(item.size);
    return acc;
  }, {});

  const inputClass = "w-full bg-transparent border-b border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5] dark:focus:border-[#6366f1] pb-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none transition-colors duration-150";
  const labelClass = "block text-[10px] font-medium uppercase tracking-widest text-[#6B7280] dark:text-[#555555] mb-2";
  const sectionClass = "bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-6";

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      <header className="sticky top-0 z-40 bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
        <div className="max-w-2xl mx-auto px-4 h-13 flex items-center gap-3 py-3.5">
          <Link
            to="/drive"
            className="p-1.5 rounded-md text-[#6B7280] dark:text-[#555555] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </Link>
          <span className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">Settings</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-[#F0F0F0] dark:bg-[#1A1A1A] rounded-xl p-1 w-fit">
          {(['profile', 'security', 'billing'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-[#2A2A2A] text-[#0A0A0A] dark:text-[#F5F5F5] shadow-sm'
                  : 'text-[#6B7280] dark:text-[#555555] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <>
            <section className={sectionClass}>
              <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-5">Profile</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-semibold shrink-0" style={{ backgroundColor: user?.avatarColor ?? '#4F46E5' }}>
                  {user?.displayName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{user?.displayName}</p>
                  <p className="text-xs text-[#6B6B6B] dark:text-[#888888]">{user?.email}</p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#555555]">@{user?.username}</p>
                </div>
              </div>
              <form onSubmit={handleNameSave} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className={labelClass}>Display name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" className={inputClass} />
                </div>
                <button type="submit" disabled={updateNameMutation.isPending || displayName === user?.displayName} className="h-9 px-4 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                  {updateNameMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </form>
            </section>

            <section className={sectionClass}>
              <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-5">Change password</h2>
              <form onSubmit={handlePasswordChange} className="space-y-5">
                <div>
                  <label className={labelClass}>Current password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className={`${inputClass} pr-8`} />
                    <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-0 bottom-2 text-[#6B7280] dark:text-[#555555] hover:text-[#6B6B6B] dark:hover:text-[#888888] transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>New password</label>
                    <input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} placeholder="Min. 8 characters" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm password</label>
                    <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <button type="submit" disabled={changePasswordMutation.isPending} className="h-9 px-5 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {changePasswordMutation.isPending ? 'Updating…' : 'Change password'}
                </button>
              </form>
            </section>

            <section className={sectionClass}>
              <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-5">Storage</h2>
              {stats ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-[#6B6B6B] dark:text-[#888888]">{stats.storageUsedFormatted} of {stats.storageLimitFormatted}</span>
                      <span className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{stats.percentage}%</span>
                    </div>
                    <div className="h-[3px] bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${stats.percentage > 85 ? 'bg-red-500' : 'bg-[#4F46E5]'}`} style={{ width: `${stats.percentage}%` }} />
                    </div>
                  </div>
                  {storageBreakdown && Object.keys(storageBreakdown).length > 0 && (
                    <div>
                      <p className={labelClass}>Breakdown</p>
                      {Object.entries(storageBreakdown).map(([cat, size]) => (
                        <div key={cat} className="flex items-center justify-between py-2 border-b border-[#F0F0F0] dark:border-[#1E1E1E] last:border-0">
                          <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5]">{cat}</span>
                          <span className="text-xs text-[#6B7280] dark:text-[#555555]">{formatFileSize(size)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#6B7280] dark:text-[#555555]">Loading storage info…</p>
              )}
            </section>

            <section className={sectionClass}>
              <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-5">Preferences</h2>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">Appearance</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-0.5">Currently using {theme === 'dark' ? 'dark' : 'light'} mode</p>
                  </div>
                  <button onClick={toggleTheme} className="flex items-center gap-2 h-8 px-3 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors">
                    {theme === 'dark' ? <><Sun className="w-3.5 h-3.5" strokeWidth={1.5} /> Light mode</> : <><Moon className="w-3.5 h-3.5" strokeWidth={1.5} /> Dark mode</>}
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-[#F0F0F0] dark:border-[#1E1E1E] pt-5">
                  <div>
                    <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">Language</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-0.5">Choose your preferred display language</p>
                  </div>
                  <LanguageSwitcher />
                </div>
              </div>
            </section>

            <ReferralSection />

            <section className="border border-red-100 dark:border-red-900/30 rounded-xl p-6">
              <h2 className="text-xs font-medium text-red-500 mb-4">Danger zone</h2>
              <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-2 h-9 px-4 text-xs font-medium border border-red-200 dark:border-red-900/40 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} /> Sign out
              </button>
            </section>
          </>
        )}

        {/* ── BILLING TAB ── */}
        {activeTab === 'billing' && <BillingTab />}

        {/* ── SECURITY TAB ── */}
        {activeTab === 'security' && (
          <>
            {/* Login History */}
            <section className={sectionClass}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">Login history</h2>
                {loginHistory.length > 0 && (
                  <button
                    onClick={() => clearHistoryMutation.mutate()}
                    disabled={clearHistoryMutation.isPending}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {clearHistoryMutation.isPending ? 'Clearing…' : 'Clear history'}
                  </button>
                )}
              </div>

              {loginHistory.length === 0 ? (
                <p className="text-xs text-[#6B7280] dark:text-[#555555]">No login history recorded yet.</p>
              ) : (
                <div className="space-y-0">
                  {loginHistory.map(entry => {
                    const isMobile = /android|ios|iphone|ipad|mobile/i.test(entry.os.toLowerCase());
                    return (
                      <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E] last:border-0">
                        <div className="w-8 h-8 rounded-lg bg-[#F8F8F8] dark:bg-[#1E1E1E] flex items-center justify-center shrink-0 mt-0.5">
                          {isMobile
                            ? <Smartphone className="w-4 h-4 text-[#6B6B6B] dark:text-[#888888]" strokeWidth={1.5} />
                            : <Monitor className="w-4 h-4 text-[#6B6B6B] dark:text-[#888888]" strokeWidth={1.5} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">
                              {entry.browser} on {entry.os}
                            </p>
                            {entry.isCurrent && (
                              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#6B7280] dark:text-[#555555]">
                            {entry.ipAddress} · {new Date(entry.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Email Notifications */}
            <section className={sectionClass}>
              <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-5">Email notifications</h2>
              <div className="space-y-4 mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">Email notifications</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-0.5">Master toggle for all email notifications</p>
                  </div>
                  <button
                    onClick={() => setEmailNotifications(v => !v)}
                    className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${emailNotifications ? 'bg-[#4F46E5]' : 'bg-[#E5E5E5] dark:bg-[#2A2A2A]'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${emailNotifications ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {emailNotifications && (
                  <div className="pl-4 border-l-2 border-[#E5E5E5] dark:border-[#2A2A2A] space-y-3">
                    {[
                      { label: 'New sign-in alerts', desc: 'When your account is accessed from a new device' },
                      { label: 'Storage warnings', desc: 'When you reach 80% or 95% of storage' },
                      { label: 'File shared', desc: 'Confirmation when you create a share link' },
                      { label: 'Password changes', desc: 'When your password is changed' },
                    ].map(item => (
                      <div key={item.label} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-1.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{item.label}</p>
                          <p className="text-[11px] text-[#6B7280] dark:text-[#555555]">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                className="h-9 px-5 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingNotif ? 'Saving…' : 'Save preferences'}
              </button>
            </section>

            {/* 2FA */}
            <section className={sectionClass}>
              <h2 className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-5">Two-factor authentication</h2>

              {twoFactorEnabled ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
                      <ShieldCheck className="w-4.5 h-4.5 text-green-500" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">2FA is active</p>
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-full">Enabled</span>
                      </div>
                      <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-0.5">Your account is protected with 2FA</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDisable2FA(true)}
                    className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium border border-red-200 dark:border-red-900/40 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <ShieldOff className="w-3.5 h-3.5" strokeWidth={1.5} /> Disable
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#F8F8F8] dark:bg-[#1E1E1E] flex items-center justify-center shrink-0">
                    <ShieldOff className="w-4.5 h-4.5 text-[#6B7280] dark:text-[#555555]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-1">Enable Two-Factor Authentication</p>
                    <p className="text-xs text-[#6B6B6B] dark:text-[#888888] mb-4 leading-relaxed">
                      Add an extra layer of security. You'll need a code from your phone every time you sign in.
                    </p>
                    <button
                      onClick={() => setShow2FASetup(true)}
                      className="h-9 px-4 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors"
                    >
                      Set up 2FA →
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {show2FASetup && (
        <TwoFactorSetupModal
          onClose={() => setShow2FASetup(false)}
          onEnabled={() => {
            setTwoFactorEnabled(true);
            updateUser({ ...user!, twoFactorEnabled: true });
          }}
        />
      )}

      {showDisable2FA && (
        <Disable2FAModal
          onClose={() => setShowDisable2FA(false)}
          onDisabled={() => {
            setTwoFactorEnabled(false);
            updateUser({ ...user!, twoFactorEnabled: false });
          }}
        />
      )}
    </div>
  );
}
