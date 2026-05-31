import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { authApi } from '@/api/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Email is required'); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
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

        {sent ? (
          <div className="animate-fade-up">
            <div className="w-10 h-10 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-center mb-8">
              <span className="text-lg">✉️</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">Check your inbox</h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888] leading-relaxed mb-8">
              If <span className="text-[#0A0A0A] dark:text-[#F5F5F5] font-medium">{email}</span> has an account, a reset link is on its way. Check your spam folder too.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Reset password</h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-10">
              Enter your email and we'll send a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] uppercase tracking-wider mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  autoComplete="email"
                  className={`w-full bg-transparent border-0 border-b py-2.5 px-0 text-sm placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none transition-colors duration-200 ${
                    error ? 'border-b-red-500' : 'border-b-[#E5E5E5] dark:border-b-[#2A2A2A] focus:border-b-[#4F46E5] dark:focus:border-b-[#6366f1]'
                  }`}
                />
                {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] text-sm font-semibold rounded-xl hover:bg-[#1A1A1A] dark:hover:bg-white transition-all duration-150 disabled:opacity-40"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />Sending...</>
                ) : (
                  <>Send reset link <ArrowRight className="w-4 h-4" strokeWidth={2} /></>
                )}
              </button>
            </form>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 mt-8 text-sm text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
