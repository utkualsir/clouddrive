import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/api/auth';
import { useTranslation } from 'react-i18next';

function Field({
  label, id, type = 'text', placeholder, value, onChange, error, autoComplete,
}: {
  label: string; id: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void; error?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={`w-full bg-transparent border-0 border-b py-2.5 px-0 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${
          error
            ? 'border-b-red-500'
            : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)]
    .filter(Boolean).length;
  if (!password) return null;
  const colors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${i < score ? colors[score - 1] : 'bg-[#E5E5E5] dark:bg-[#2A2A2A]'}`} />
        ))}
      </div>
      <p className={`text-xs ${['text-red-500', 'text-orange-400', 'text-yellow-400', 'text-green-500'][score - 1] ?? 'text-[#AAAAAA]'}`}>
        {labels[score - 1] ?? ''}
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') ?? '';
  const [form, setForm] = useState({ email: '', username: '', displayName: '', password: '', confirm: '', referralCode: refCode });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.displayName.trim()) e.displayName = 'Required';
    if (!form.username.trim()) e.username = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    if (form.password.length < 8) e.password = 'Min. 8 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: Parameters<typeof authApi.register>[0] = { email: form.email, username: form.username, displayName: form.displayName, password: form.password };
      if (form.referralCode.trim()) payload.referralCode = form.referralCode.trim().toUpperCase();
      const res = await authApi.register(payload);
      if (res.success && res.data) {
        login(res.data.token, res.data.user);
        navigate('/drive');
        if (form.referralCode.trim()) {
          toast.success('🎉 You got 5 GB bonus storage!', { duration: 5000 });
        } else {
          toast.success(`Welcome, ${res.data.user.displayName}!`);
        }
      }
    } catch (err: unknown) {
      type AxiosErr = { response?: { data?: { error?: string } }; code?: string; message?: string };
      const e = err as AxiosErr;
      const serverMsg = e.response?.data?.error;

      if (serverMsg) {
        const lower = serverMsg.toLowerCase();
        if (lower.includes('email')) {
          setErrors(prev => ({ ...prev, email: serverMsg }));
        } else if (lower.includes('username')) {
          setErrors(prev => ({ ...prev, username: serverMsg }));
        } else if (lower.includes('password')) {
          setErrors(prev => ({ ...prev, password: serverMsg }));
        } else {
          toast.error(serverMsg);
        }
      } else if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED') {
        toast.error('Cannot reach the server. Make sure the server is running on port 3001.');
      } else {
        toast.error(e.message ?? 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5]">
      {/* Brand panel */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between p-12 border-r border-[#E5E5E5] dark:border-[#2A2A2A]">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#4F46E5] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">CloudDrive</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-3">Your drive starts here.</h2>
          <p className="text-sm text-[#6B6B6B] dark:text-[#888888] leading-relaxed mb-8">
            5 GB free storage. Encrypted folders. Zero compromise.
          </p>
          <div className="space-y-3">
            {['5 GB included, no card required', 'Password-protected folders', 'Access from any device'].map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-[#6B6B6B] dark:text-[#888888]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#AAAAAA] dark:text-[#444444]">© 2024 CloudDrive</p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[360px] animate-fade-up">
          <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#4F46E5] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-sm">CloudDrive</span>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight mb-1">{t('auth.signUp')}</h1>
          <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-10">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-[#4F46E5] dark:text-[#6366f1] hover:underline font-medium">{t('auth.signIn')}</Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Field label={t('auth.displayName')} id="displayName" placeholder="Jane Doe" value={form.displayName} onChange={set('displayName')} error={errors.displayName} autoComplete="name" />

            <div className="grid grid-cols-2 gap-5">
              <Field label={t('auth.username')} id="username" placeholder="janedoe" value={form.username} onChange={set('username')} error={errors.username} autoComplete="username" />
              <Field label={t('auth.email')} id="email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">{t('auth.password')}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => set('password')(e.target.value)}
                  autoComplete="new-password"
                  className={`w-full bg-transparent border-0 border-b py-2.5 px-0 pr-8 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${errors.password ? 'border-b-red-500' : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'}`}
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#6B6B6B] transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
              <PasswordStrength password={form.password} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={e => set('confirm')(e.target.value)}
                autoComplete="new-password"
                className={`w-full bg-transparent border-0 border-b py-2.5 px-0 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${errors.confirm ? 'border-b-red-500' : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'}`}
              />
              {errors.confirm && <p className="mt-1.5 text-xs text-red-500">{errors.confirm}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">
                Referral Code <span className="normal-case font-normal text-[#AAAAAA] dark:text-[#444444]">(optional · +5 GB)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. JANE4X2B"
                value={form.referralCode}
                onChange={e => set('referralCode')(e.target.value.toUpperCase())}
                autoComplete="off"
                className="w-full bg-transparent border-0 border-b py-2.5 px-0 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1] font-mono tracking-widest"
              />
              {form.referralCode && (
                <p className="mt-1.5 text-xs text-emerald-500 flex items-center gap-1">🎁 +5 GB bonus will be applied</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] text-sm font-semibold rounded-xl hover:bg-[#1A1A1A] dark:hover:bg-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />{t('auth.creatingAccount')}</>
              ) : (
                <>{t('auth.signUp')} <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
