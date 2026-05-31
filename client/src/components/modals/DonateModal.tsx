import { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { paymentsApi, PaymentInfo } from '@/api/payments';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

type Currency = 'TRY' | 'USD' | 'EUR';

const CURRENCY_SYMBOLS: Record<Currency, string> = { TRY: '₺', USD: '$', EUR: '€' };
const CURRENCY_FLAGS: Record<string, string> = { TRY: '🇹🇷', USD: '🇺🇸', EUR: '🇪🇺' };

const AMOUNT_CHIPS: Record<Currency, number[]> = {
  TRY: [10, 25, 50, 100],
  USD: [1, 3, 5, 10],
  EUR: [1, 3, 5, 10],
};

function useCurrencyStorage(): [Currency, (c: Currency) => void] {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const stored = localStorage.getItem('clouddrive-currency');
    return stored === 'TRY' || stored === 'USD' || stored === 'EUR' ? stored : 'TRY';
  });
  const setCurrency = (c: Currency) => {
    localStorage.setItem('clouddrive-currency', c);
    setCurrencyState(c);
  };
  return [currency, setCurrency];
}

function AnimatedCheckmark() {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 100);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M20 6L9 17l-5-5"
          strokeDasharray="28"
          strokeDashoffset={drawn ? 0 : 28}
          style={{ transition: 'stroke-dashoffset 0.5s ease 0.1s' }}
        />
      </svg>
    </div>
  );
}

function IbanCard({ info, copiedIban, onCopy }: { info: PaymentInfo; copiedIban: string | null; onCopy: (iban: string) => void }) {
  const flag = CURRENCY_FLAGS[info.currency] ?? '🏦';
  const isCopied = copiedIban === info.iban;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#F8F8F8] dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">{flag} {info.label}</p>
        <p className="text-[11px] text-[#6B6B6B] dark:text-[#888888] font-mono truncate">{info.iban}</p>
      </div>
      <button
        onClick={() => onCopy(info.iban)}
        className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
          isCopied
            ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
            : 'bg-[#E5E5E5] dark:bg-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:bg-[#D5D5D5] dark:hover:bg-[#333333]'
        }`}
      >
        {isCopied ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <Copy className="w-3 h-3" strokeWidth={1.5} />}
        {isCopied ? 'Copied! ✓' : 'Copy'}
      </button>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export default function DonateModal({ onClose }: Props) {
  const { user } = useAuth();
  const [currency, setCurrency] = useCurrencyStorage();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [copiedIban, setCopiedIban] = useState<string | null>(null);

  const { data: paymentInfoData } = useQuery({
    queryKey: ['payment-info'],
    queryFn: () => paymentsApi.getPaymentInfo(),
    enabled: !!user,
  });

  const paymentInfoList: PaymentInfo[] = paymentInfoData?.data ?? [];
  const activeInfoList = paymentInfoList.filter(p => p.active);

  const symbol = CURRENCY_SYMBOLS[currency];
  const chips = AMOUNT_CHIPS[currency];
  const actualAmount = showCustom ? parseFloat(customAmount) || 0 : (selectedAmount ?? 0);
  const canSubmit = actualAmount > 0 && !!user;

  useEffect(() => {
    setSelectedAmount(null);
    setCustomAmount('');
    setShowCustom(false);
  }, [currency]);

  const createMutation = useMutation({
    mutationFn: () =>
      paymentsApi.createRequest({
        type: 'DONATE',
        amount: actualAmount,
        currency,
        note: message.trim() || undefined,
      }),
    onSuccess: () => setStep(2),
    onError: () => toast.error('Failed to submit donation. Please try again.'),
  });

  const handleCopy = (iban: string) => {
    navigator.clipboard.writeText(iban).then(() => {
      setCopiedIban(iban);
      setTimeout(() => setCopiedIban(null), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden animate-modal-in">
        {step === 1 ? (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
              <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">
                Support CloudDrive ☁️
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#6B6B6B] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <p className="text-sm text-[#6B6B6B] dark:text-[#888888] text-center">
                Every contribution helps keep CloudDrive running and improving
              </p>

              {/* Currency selector */}
              <div className="flex items-center gap-2">
                {(['TRY', 'USD', 'EUR'] as Currency[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border-2 transition-all ${
                      currency === c
                        ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5]'
                        : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'
                    }`}
                  >
                    {CURRENCY_FLAGS[c]} {c}
                  </button>
                ))}
                <div className="relative group flex-1">
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border-2 border-[#E5E5E5] dark:border-[#2A2A2A] text-[#CCCCCC] dark:text-[#444444] cursor-not-allowed"
                  >
                    🇭🇺 HUF
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[10px] bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Coming Soon
                  </div>
                </div>
              </div>

              {/* Amount chips */}
              <div>
                <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888] mb-2.5">Select amount</p>
                <div className="flex flex-wrap gap-2">
                  {chips.map(amount => (
                    <button
                      key={amount}
                      onClick={() => { setSelectedAmount(amount); setShowCustom(false); }}
                      className={`px-4 py-2 text-sm font-semibold rounded-xl border-2 transition-all ${
                        !showCustom && selectedAmount === amount
                          ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5]'
                          : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'
                      }`}
                    >
                      {symbol}{amount}
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowCustom(true); setSelectedAmount(null); }}
                    className={`px-4 py-2 text-sm font-semibold rounded-xl border-2 transition-all ${
                      showCustom
                        ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5]'
                        : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {showCustom && (
                  <div className="mt-3 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B6B6B]">{symbol}</span>
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="any"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-4 py-2 text-sm bg-[#F8F8F8] dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-[#0A0A0A] dark:text-[#F5F5F5] outline-none focus:border-[#4F46E5] transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* IBAN cards — only for logged-in users */}
              {user && activeInfoList.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#6B6B6B] dark:text-[#888888] mb-3">
                    Send payment to one of these accounts
                  </p>
                  <div className="space-y-2">
                    {activeInfoList.map(info => (
                      <IbanCard key={info.currency} info={info} copiedIban={copiedIban} onCopy={handleCopy} />
                    ))}
                  </div>
                </div>
              )}

              {/* Username notice */}
              {user && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                  <span className="text-base leading-none shrink-0 mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Include your username (<strong>@{user.username}</strong>) in the transfer description so we can identify your donation
                  </p>
                </div>
              )}

              {/* Message field */}
              <div>
                <label className="block text-xs font-medium text-[#6B6B6B] dark:text-[#888888] mb-1.5">
                  Leave a message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 200))}
                  rows={3}
                  placeholder="Your message to the team…"
                  className="w-full px-3 py-2 text-sm bg-[#F8F8F8] dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#AAAAAA] outline-none focus:border-[#4F46E5] resize-none transition-colors"
                />
                <p className="text-[11px] text-[#AAAAAA] text-right mt-1">{message.length}/200</p>
              </div>

              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !canSubmit}
                className="w-full py-3 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {createMutation.isPending ? 'Submitting…' : "I've Donated ❤️"}
              </button>

              {!user && (
                <p className="text-center text-xs text-[#AAAAAA] dark:text-[#555555]">
                  <Link to="/login" className="text-[#4F46E5] hover:underline">Sign in</Link> to submit your donation
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-4">
            <AnimatedCheckmark />
            <h2 className="text-xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">
              Thank you for your support! ❤️
            </h2>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888] max-w-xs leading-relaxed">
              Your contribution means a lot to us.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
