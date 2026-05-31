import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/api/auth';
import { useTranslation } from 'react-i18next';

function AuthBrand({ tagline }: { tagline: string }) {
  return (
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
        <h2 className="text-3xl font-bold tracking-tight text-[#0A0A0A] dark:text-[#F5F5F5] mb-3">{tagline}</h2>
        <p className="text-sm text-[#6B6B6B] dark:text-[#888888] leading-relaxed">
          Your files are encrypted, organized, and accessible from anywhere.
        </p>
      </div>
      <p className="text-xs text-[#AAAAAA] dark:text-[#444444]">© 2024 CloudDrive</p>
    </div>
  );
}

function OtpInput({ onComplete }: { onComplete: (code: string) => void }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  const handleDigit = (i: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const val = value.slice(-1);
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (next.every(d => d !== '') && val) {
      onComplete(next.join(''));
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let j = 0; j < 6; j++) next[j] = pasted[j] ?? '';
    setDigits(next);
    const lastFilled = Math.min(pasted.length, 6) - 1;
    refs.current[lastFilled]?.focus();
    if (pasted.length >= 6) onComplete(pasted.slice(0, 6));
  };

  if (useBackup) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">
            Backup code
          </label>
          <input
            type="text"
            value={backupCode}
            onChange={e => setBackupCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            autoComplete="off"
            className="w-full bg-transparent border-0 border-b border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] py-2.5 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none tracking-widest font-mono"
          />
        </div>
        <button
          type="button"
          onClick={() => { if (backupCode.length >= 8) onComplete(backupCode); }}
          disabled={backupCode.length < 8}
          className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] text-sm font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Verify backup code
        </button>
        <button type="button" onClick={() => setUseBackup(false)} className="w-full text-xs text-[#AAAAAA] hover:text-[#4F46E5] transition-colors">
          Use authenticator app instead
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-between" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="w-11 h-14 text-center text-xl font-bold rounded-xl border-2 border-[#E5E5E5] dark:border-[#2A2A2A] bg-transparent text-[#0A0A0A] dark:text-[#F5F5F5] focus:border-[#4F46E5] dark:focus:border-[#6366f1] outline-none transition-colors"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setUseBackup(true)}
        className="w-full text-xs text-center text-[#AAAAAA] dark:text-[#444444] hover:text-[#4F46E5] dark:hover:text-[#6366f1] transition-colors"
      >
        Use a backup code instead
      </button>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [twoFAState, setTwoFAState] = useState<{ tempToken: string } | null>(null);
  const [twoFALoading, setTwoFALoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!form.email) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.login(form);
      if (res.success && res.data) {
        if (res.data.requiresTwoFactor && res.data.tempToken) {
          setTwoFAState({ tempToken: res.data.tempToken });
          return;
        }
        if (res.data.token && res.data.user) {
          login(res.data.token, res.data.user);
          navigate('/drive');
        }
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (code: string) => {
    if (!twoFAState) return;
    setTwoFALoading(true);
    try {
      const res = await authApi.twoFactorLogin({ tempToken: twoFAState.tempToken, code });
      if (res.success && res.data) {
        login(res.data.token, res.data.user);
        navigate('/drive');
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg ?? 'Invalid code');
    } finally {
      setTwoFALoading(false);
    }
  };

  if (twoFAState) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5]">
        <AuthBrand tagline="Two-factor authentication." />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-[360px] animate-fade-up">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 mb-8">
              <ShieldCheck className="w-7 h-7 text-[#4F46E5]" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Enter your code</h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-10">
              Open your authenticator app and enter the 6-digit code for CloudDrive.
            </p>
            {twoFALoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#4F46E5]" />
              </div>
            ) : (
              <OtpInput onComplete={handle2FA} />
            )}
            <button
              type="button"
              onClick={() => setTwoFAState(null)}
              className="mt-6 w-full text-xs text-center text-[#AAAAAA] dark:text-[#444444] hover:text-[#4F46E5] transition-colors"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5]">
      <AuthBrand tagline="Welcome back." />

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px] animate-fade-up">
          <Link to="/" className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-[#4F46E5] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight">CloudDrive</span>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight mb-1">{t('auth.signIn')}</h1>
          <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-10">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-[#4F46E5] dark:text-[#6366f1] hover:underline font-medium">
              {t('auth.createOneFree')}
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setErrors(v => ({ ...v, email: undefined })); }}
                autoComplete="email"
                className={`w-full bg-transparent border-0 border-b py-2.5 px-0 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${
                  errors.email
                    ? 'border-b-red-500'
                    : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'
                }`}
              />
              {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider">
                  {t('auth.password')}
                </label>
                <Link to="/forgot-password" className="text-xs text-[#AAAAAA] dark:text-[#444444] hover:text-[#4F46E5] dark:hover:text-[#6366f1] transition-colors">
                  {t('auth.forgot')}
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(v => ({ ...v, password: undefined })); }}
                  autoComplete="current-password"
                  className={`w-full bg-transparent border-0 border-b py-2.5 px-0 pr-8 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${
                    errors.password
                      ? 'border-b-red-500'
                      : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] dark:hover:text-[#888888] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] text-sm font-semibold rounded-xl hover:bg-[#1A1A1A] dark:hover:bg-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />{t('auth.signingIn')}</>
              ) : (
                <>{t('auth.signIn')} <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
