import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '@/api/auth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (form.password.length < 8) e.password = 'Min. 8 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error('Invalid reset link'); return; }
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, form.password);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2500);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(msg ?? 'Reset failed. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5] px-6">
      <div className="w-full max-w-[360px] animate-fade-up">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <div className="w-7 h-7 rounded-lg bg-[#4F46E5] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">CloudDrive</span>
        </Link>

        {!token ? (
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Invalid link</h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-8">
              This reset link is missing or invalid. Request a new one.
            </p>
            <Link to="/forgot-password" className="inline-flex items-center gap-2 text-sm font-medium text-[#4F46E5] dark:text-[#6366f1] hover:underline">
              Request new link <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
          </div>
        ) : success ? (
          <div className="animate-fade-up">
            <div className="w-10 h-10 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-center mb-8">
              <span className="text-lg">✓</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Password reset</h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">
              Redirecting you to sign in...
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Set new password</h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-10">
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(v => ({ ...v, password: undefined })); }}
                    className={`w-full bg-transparent border-0 border-b py-2.5 px-0 pr-8 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${errors.password ? 'border-b-red-500' : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'}`}
                  />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#6B6B6B] transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">Confirm password</label>
                <input
                  type="password"
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setErrors(v => ({ ...v, confirm: undefined })); }}
                  className={`w-full bg-transparent border-0 border-b py-2.5 px-0 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${errors.confirm ? 'border-b-red-500' : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'}`}
                />
                {errors.confirm && <p className="mt-1.5 text-xs text-red-500">{errors.confirm}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] text-sm font-semibold rounded-xl hover:bg-[#1A1A1A] dark:hover:bg-white transition-all duration-150 disabled:opacity-40"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />Resetting...</>
                ) : (
                  <>Reset password <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
                )}
              </button>
            </form>

            <Link to="/login" className="inline-flex items-center gap-2 mt-8 text-sm text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
