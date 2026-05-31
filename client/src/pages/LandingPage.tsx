import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Moon, Sun, Menu, X,
  Check, Star, Heart, Pencil, Trash2, Shield, Zap, FolderOpen, Share2, History, Monitor,
  UserPlus, Upload, Globe, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/api/reviews';
import { Review, OnlineUser } from '@/types';
import ReviewModal from '@/components/modals/ReviewModal';
import PaymentModal from '@/components/modals/PaymentModal';
import DonateModal from '@/components/modals/DonateModal';
import SocialButtons from '@/components/SocialButtons';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import toast from 'react-hot-toast';
import api from '@/api/axios';
import { useTranslation } from 'react-i18next';

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [threshold]);
  return scrolled;
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState('');
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: '-40% 0px -55% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [ids]);
  return active;
}

function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── Particle Background ──────────────────────────────────────────────────────
function ParticleBackground() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      size: 2 + (i * 13 % 5),
      left: (i * 37 + 11) % 100,
      top: (i * 53 + 7) % 100,
      duration: 12 + (i * 7 % 10),
      delay: (i * 3) % 6,
      opacity: 0.08 + (i % 5) * 0.04,
    }))
  , []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-indigo-500 dark:bg-indigo-400 animate-particle-float"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            '--p-opacity': p.opacity,
            '--p-duration': `${p.duration}s`,
            '--p-delay': `${p.delay}s`,
            opacity: p.opacity,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Animated Headline ────────────────────────────────────────────────────────
function AnimatedHeadline({ line1, line2 }: { line1: string; line2: string }) {
  const allWords = [...line1.split(' '), ...line2.split(' ')];
  const line1Count = line1.split(' ').length;
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers = allWords.map((_, i) =>
      setTimeout(() => setVisibleCount(prev => Math.max(prev, i + 1)), i * 100)
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const line1Words = allWords.slice(0, line1Count);
  const line2Words = allWords.slice(line1Count);

  return (
    <h1 className="max-w-3xl text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-[#0A0A0A] dark:text-[#F5F5F5] text-balance mb-6">
      {line1Words.map((word, i) => (
        <span
          key={`l1-${i}`}
          className="inline-block transition-all duration-300"
          style={{ opacity: visibleCount > i ? 1 : 0, transform: visibleCount > i ? 'none' : 'translateY(8px)', marginRight: '0.28em' }}
        >
          {word}
        </span>
      ))}{' '}
      <span className="text-[#4F46E5] dark:text-[#6366f1]">
        {line2Words.map((word, i) => (
          <span
            key={`l2-${i}`}
            className="inline-block transition-all duration-300"
            style={{ opacity: visibleCount > line1Count + i ? 1 : 0, transform: visibleCount > line1Count + i ? 'none' : 'translateY(8px)', marginRight: '0.28em' }}
          >
            {word}
          </span>
        ))}
      </span>
    </h1>
  );
}

// ─── Live Counter ──────────────────────────────────────────────────────────────
function LiveCounter({ template }: { template: string }) {
  const [count, setCount] = useState(1247);
  useEffect(() => {
    const id = setInterval(() => setCount(c => c + 1), 3000);
    return () => clearInterval(id);
  }, []);
  const text = template.replace('{{count}}', count.toLocaleString());
  return (
    <p className="text-sm text-[#AAAAAA] dark:text-[#444444] animate-fade-up [animation-delay:240ms]">
      <span className="text-[#4F46E5] dark:text-[#6366f1] font-semibold">{count.toLocaleString()}</span>{' '}
      {text.replace(/^\d[\d,]*\s*/, '')}
    </p>
  );
}

// ─── Scroll Indicator ─────────────────────────────────────────────────────────
function ScrollIndicator() {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[#AAAAAA] dark:text-[#444444] animate-bounce-arrow">
      <ChevronDown className="w-5 h-5" strokeWidth={1.5} />
    </div>
  );
}

// ─── App Mockup ───────────────────────────────────────────────────────────────
function AppMockup() {
  const { t } = useTranslation();
  return (
    <div className="relative w-full max-w-3xl mx-auto rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] overflow-hidden bg-white dark:bg-[#0A0A0A] shadow-[0_20px_60px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#F8F8F8] dark:bg-[#141414] border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="mx-auto flex items-center gap-2 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded px-3 py-1 w-48">
          <div className="w-2 h-2 rounded-full bg-[#AAAAAA]" />
          <div className="h-1.5 bg-[#AAAAAA]/50 rounded flex-1" />
        </div>
      </div>
      <div className="flex h-56">
        <div className="w-40 shrink-0 border-r border-[#E5E5E5] dark:border-[#2A2A2A] p-3 flex flex-col gap-0.5">
          {[{ label: t('nav.myDrive'), active: true }, { label: t('nav.recent'), active: false }, { label: t('nav.starred'), active: false }, { label: t('nav.trash'), active: false }].map(({ label, active }) => (
            <div key={label} className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs ${active ? 'border-l-2 border-[#4F46E5] text-[#4F46E5] pl-[9px]' : 'text-[#AAAAAA] dark:text-[#444444]'}`}>
              <div className={`w-2 h-2 rounded-sm ${active ? 'bg-[#4F46E5]' : 'bg-[#E5E5E5] dark:bg-[#2A2A2A]'}`} />
              <span className="font-medium">{label}</span>
            </div>
          ))}
          <div className="mt-auto pt-3 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
            <div className="h-1 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
              <div className="h-full w-[30%] bg-[#4F46E5] rounded-full" />
            </div>
            <p className="text-[10px] text-[#AAAAAA] mt-1">1.5 GB of 5 GB</p>
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="grid grid-cols-4 gap-2.5">
            {[{ color: '#4F46E5', label: 'Projects', ext: '' }, { color: '#10B981', label: 'photo.jpg', ext: 'jpg' }, { color: '#EF4444', label: 'report.pdf', ext: 'pdf' }, { color: '#4F46E5', label: 'design.fig', ext: 'fig' }, { color: '#F59E0B', label: 'archive.zip', ext: 'zip' }, { color: '#8B5CF6', label: 'demo.mp4', ext: 'mp4' }, { color: '#10B981', label: 'photo2.png', ext: 'png' }, { color: '#EC4899', label: 'audio.mp3', ext: 'mp3' }].map(({ color, label, ext }) => (
              <div key={label} className="border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg p-2.5 flex flex-col gap-2 bg-white dark:bg-[#1E1E1E]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {ext && <span className="text-[9px] font-mono text-[#AAAAAA] uppercase">{ext}</span>}
                  {!ext && <FolderOpen className="w-3 h-3" style={{ color }} strokeWidth={1.5} />}
                </div>
                <div className="h-1.5 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded w-[80%]" />
                <div className="h-1 bg-[#F0F0F0] dark:bg-[#252525] rounded w-[50%]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Online Indicator ──────────────────────────────────────────────────────────
function OnlineIndicator() {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const { data } = useQuery<{ success: boolean; data: OnlineUser[] }>({
    queryKey: ['online-users'],
    queryFn: () => api.get('/api/users/online').then(r => r.data),
    refetchInterval: 30000,
  });
  const online = data?.data ?? [];
  if (online.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA] transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
        {online.length} {t('landing.reviews.online')}
      </button>
      {showDropdown && (
        <div className="absolute left-0 top-full mt-2 w-44 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] p-2 z-50 animate-modal-in">
          {online.map(u => (
            <div key={u.username} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]" title={`@${u.username}`}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0" style={{ backgroundColor: u.avatarColor }}>
                {u.displayName[0].toUpperCase()}
              </div>
              <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{u.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Star Display ──────────────────────────────────────────────────────────────
function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${cls} ${s <= rating ? 'text-[#4F46E5] fill-[#4F46E5]' : 'text-[#E5E5E5] dark:text-[#2A2A2A]'}`} strokeWidth={1.5} />
      ))}
    </div>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────
function ReviewCard({ review, currentUserId, onLike, onEdit, onDelete, index }: {
  review: Review; currentUserId?: string;
  onLike: (id: string) => void; onEdit: (r: Review) => void;
  onDelete: (id: string) => void; index: number;
}) {
  const { t } = useTranslation();
  const isOwn = currentUserId === review.userId;
  return (
    <div
      className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5 animate-fade-up flex flex-col gap-3"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ backgroundColor: review.avatarColor }}>
            {review.displayName[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{review.displayName}</p>
            <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{t('landing.reviews.memberSince')} {memberSince(review.memberSince)}</p>
          </div>
        </div>
        {isOwn && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(review)} className="p-1.5 rounded-md text-[#AAAAAA] hover:text-[#6B6B6B] hover:bg-[#F0F0F0] dark:hover:bg-[#252525] transition-colors">
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button onClick={() => onDelete(review.id)} className="p-1.5 rounded-md text-[#AAAAAA] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
      <StarDisplay rating={review.rating} />
      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5] leading-relaxed flex-1">{review.comment}</p>
      <div className="flex items-center justify-between pt-1 border-t border-[#F0F0F0] dark:border-[#1E1E1E]">
        <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{timeAgo(review.createdAt)}</p>
        <button
          onClick={() => !isOwn && onLike(review.id)}
          disabled={isOwn}
          className={`flex items-center gap-1.5 text-[11px] transition-colors ${review.hasLiked ? 'text-red-500' : 'text-[#AAAAAA] dark:text-[#444444] hover:text-red-400'} disabled:cursor-not-allowed`}
        >
          <Heart className={`w-3.5 h-3.5 ${review.hasLiked ? 'fill-red-500' : ''}`} strokeWidth={1.5} />
          {review.likes > 0 && review.likes}
        </button>
      </div>
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const steps = [
    { icon: UserPlus, titleKey: 'landing.howItWorks.step1Title', descKey: 'landing.howItWorks.step1Desc', num: 1 },
    { icon: Upload,   titleKey: 'landing.howItWorks.step2Title', descKey: 'landing.howItWorks.step2Desc', num: 2 },
    { icon: Globe,    titleKey: 'landing.howItWorks.step3Title', descKey: 'landing.howItWorks.step3Desc', num: 3 },
  ];

  return (
    <section ref={sectionRef} className="py-28 px-5 sm:px-8 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-3">{t('landing.howItWorks.badge')}</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{t('landing.howItWorks.title')}</h2>
        </div>
        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Dashed connector line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] border-t-2 border-dashed border-[#E5E5E5] dark:border-[#2A2A2A]" />
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="flex flex-col items-center text-center"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 0.15}s, transform 0.5s ease ${i * 0.15}s`,
              }}
            >
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center mb-0">
                  <step.icon className="w-8 h-8 text-[#4F46E5] dark:text-[#6366f1]" strokeWidth={1.5} />
                </div>
                <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-[#4F46E5] text-white text-xs font-bold flex items-center justify-center">
                  {step.num}
                </div>
              </div>
              <h3 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-2">{t(step.titleKey)}</h3>
              <p className="text-sm text-[#6B6B6B] dark:text-[#888888] leading-relaxed max-w-[220px]">{t(step.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing Section ──────────────────────────────────────────────────────────
type Currency = 'TRY' | 'USD' | 'EUR';

const CURRENCY_SYMBOLS_PRICING: Record<Currency, string> = { TRY: '₺', USD: '$', EUR: '€' };

interface PricingPlan {
  id: string;
  name: string;
  storageGB: number;
  prices: Record<Currency, number>;
  originalPrices?: Record<Currency, number>;
  badge?: string;
  badgeStyle?: 'indigo' | 'amber';
  features: string[];
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    storageGB: 15,
    prices: { TRY: 0, USD: 0, EUR: 0 },
    features: ['15 GB storage', 'File sharing', 'File converter', 'Community support'],
  },
  {
    id: '100gb',
    name: '100 GB',
    storageGB: 100,
    prices: { TRY: 29, USD: 0.99, EUR: 0.99 },
    features: ['100 GB storage', 'All Free features', 'Priority support'],
  },
  {
    id: '200gb',
    name: '200 GB',
    storageGB: 200,
    prices: { TRY: 49, USD: 1.49, EUR: 1.49 },
    features: ['200 GB storage', 'All Free features', 'Advanced sharing'],
  },
  {
    id: '500gb',
    name: '500 GB',
    storageGB: 500,
    prices: { TRY: 99, USD: 2.99, EUR: 2.99 },
    features: ['500 GB storage', 'All Free features', 'Version history'],
  },
  {
    id: '1tb',
    name: '1 TB',
    storageGB: 1024,
    prices: { TRY: 149, USD: 4.49, EUR: 4.49 },
    originalPrices: { TRY: 199, USD: 5.99, EUR: 5.99 },
    badge: 'Most Popular ⭐',
    badgeStyle: 'indigo',
    features: ['1 TB storage', 'All Free features', 'Version history', 'Priority support'],
  },
  {
    id: '2tb',
    name: '2 TB',
    storageGB: 2048,
    prices: { TRY: 199, USD: 5.99, EUR: 5.99 },
    originalPrices: { TRY: 299, USD: 8.99, EUR: 8.99 },
    badge: 'Best Value 🔥',
    badgeStyle: 'amber',
    features: ['2 TB storage', 'All 1 TB features', 'Maximum performance'],
  },
];

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

function PricingSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currency, setCurrency] = useCurrencyStorage();
  const [upgradePlan, setUpgradePlan] = useState<PricingPlan | null>(null);

  const handleUpgrade = (plan: PricingPlan) => {
    if (!user) { navigate('/login'); return; }
    setUpgradePlan(plan);
  };

  const sym = CURRENCY_SYMBOLS_PRICING[currency];

  return (
    <section id="pricing" className="py-28 px-5 sm:px-8 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-3">{t('landing.pricing.badge')}</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{t('landing.pricing.title')}</h2>
          <p className="mt-4 text-lg text-[#6B6B6B] dark:text-[#888888]">{t('landing.pricing.subtitle')}</p>
          <Link to="/register" className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#4F46E5] dark:text-[#6366f1] hover:underline font-medium">
            🎁 Invite friends for free storage →
          </Link>

          {/* Currency selector */}
          <div className="inline-flex items-center gap-2 mt-8">
            {(['TRY', 'USD', 'EUR'] as Currency[]).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border-2 transition-all ${
                  currency === c
                    ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5]'
                    : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'
                }`}
              >
                {c === 'TRY' ? '🇹🇷' : c === 'USD' ? '🇺🇸' : '🇪🇺'} {c}
              </button>
            ))}
            <div className="relative group">
              <button
                disabled
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border-2 border-[#E5E5E5] dark:border-[#2A2A2A] text-[#CCCCCC] dark:text-[#444444] cursor-not-allowed"
              >
                🇭🇺 HUF
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Coming Soon
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PRICING_PLANS.map(plan => {
            const price = plan.prices[currency];
            const originalPrice = plan.originalPrices?.[currency];
            const userPlan = user?.plan ?? 'free';
            const isCurrentPlan = userPlan === plan.id;
            const is1TB = plan.id === '1tb';
            const is2TB = plan.id === '2tb';

            const borderClass = is1TB
              ? 'border-2 border-[#4F46E5]'
              : is2TB
              ? 'border-2 border-amber-500'
              : 'border border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] dark:hover:border-[#6366f1]';

            return (
              <div key={plan.id} className={`relative flex flex-col p-7 rounded-2xl bg-white dark:bg-[#0A0A0A] transition-all duration-200 ${borderClass}`}>
                {plan.badge && (
                  <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider whitespace-nowrap ${plan.badgeStyle === 'amber' ? 'bg-amber-500 text-white' : 'bg-[#4F46E5] text-white'}`}>
                    {plan.badge}
                  </div>
                )}

                <p className={`text-sm font-semibold mb-1 ${is1TB ? 'text-[#4F46E5]' : is2TB ? 'text-amber-500' : 'text-[#6B6B6B] dark:text-[#888888]'}`}>
                  {plan.name}
                </p>

                <div className="flex items-end gap-1.5 mb-1">
                  {originalPrice !== undefined && (
                    <span className="text-sm line-through text-[#AAAAAA] dark:text-[#444444] mb-0.5">
                      {sym}{originalPrice}
                    </span>
                  )}
                  <span className="text-3xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{sym}{price}</span>
                  <span className="text-[#AAAAAA] dark:text-[#444444] mb-0.5">/ month</span>
                </div>
                <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mb-5">
                  {plan.id === 'free' ? 'Forever free' : 'Billed monthly'}
                </p>

                <ul className="space-y-2.5 flex-1 mb-7">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[#6B6B6B] dark:text-[#888888]">
                      <Check className="w-3.5 h-3.5 text-[#4F46E5] shrink-0" strokeWidth={2.5} />{f}
                    </li>
                  ))}
                </ul>

                {plan.id === 'free' ? (
                  user && isCurrentPlan ? (
                    <button disabled className="w-full text-center py-2.5 px-5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-sm font-medium text-[#AAAAAA] dark:text-[#555555] cursor-not-allowed">
                      Current Plan
                    </button>
                  ) : (
                    <Link to="/register" className="block text-center py-2.5 px-5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-sm font-medium text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
                      Get Started
                    </Link>
                  )
                ) : isCurrentPlan ? (
                  <button disabled className="w-full text-center py-2.5 px-5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-sm font-medium text-[#AAAAAA] dark:text-[#555555] cursor-not-allowed">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan)}
                    className={`w-full text-center py-2.5 px-5 rounded-xl text-sm font-semibold transition-colors ${
                      is2TB
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : is1TB
                        ? 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
                        : 'border border-[#4F46E5] text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#1e1b4b]/20'
                    }`}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {upgradePlan && (
        <PaymentModal
          plan={upgradePlan}
          currency={currency}
          onClose={() => setUpgradePlan(null)}
        />
      )}
    </section>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FAQSection() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
    { q: t('landing.faq.q6'), a: t('landing.faq.a6') },
  ];

  return (
    <section className="py-28 px-5 sm:px-8 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-3">{t('landing.faq.badge')}</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{t('landing.faq.title')}</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden bg-white dark:bg-[#0A0A0A]">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors"
                >
                  <span className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5] text-sm">{faq.q}</span>
                  <span className="shrink-0 text-[#4F46E5]">
                    {isOpen ? <ChevronUp className="w-4 h-4" strokeWidth={2} /> : <ChevronDown className="w-4 h-4" strokeWidth={2} />}
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: isOpen ? '300px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.35s ease',
                  }}
                >
                  <p className="px-5 pb-4 text-sm text-[#6B6B6B] dark:text-[#888888] leading-relaxed">{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
const SECTION_IDS = ['features', 'pricing', 'reviews'];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const scrolled = useScrolled();
  const activeSection = useActiveSection(SECTION_IDS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [sort, setSort] = useState('newest');
  const [starFilter, setStarFilter] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const beat = () => api.post('/api/users/heartbeat').catch(() => {});
    beat();
    const id = setInterval(beat, 30000);
    return () => clearInterval(id);
  }, [user]);

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', sort, starFilter],
    queryFn: () => reviewsApi.getAll({ sort, rating: starFilter || undefined }),
  });

  const { data: myReviewData } = useQuery({
    queryKey: ['my-review'],
    queryFn: () => reviewsApi.getMine(),
    enabled: !!user,
  });

  const reviews: Review[] = reviewsData?.data?.reviews ?? [];
  const averageRating = reviewsData?.data?.averageRating ?? 0;
  const totalCount = reviewsData?.data?.totalCount ?? 0;
  const myReview = myReviewData?.data ?? null;

  const createMutation = useMutation({
    mutationFn: ({ rating, comment }: { rating: number; comment: string }) => reviewsApi.create({ rating, comment }),
    onSuccess: () => {
      toast.success('Review posted!');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-review'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'Failed to post review');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment: string }) => reviewsApi.update(id, { rating, comment }),
    onSuccess: () => {
      toast.success('Review updated!');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-review'] });
    },
    onError: () => toast.error('Failed to update review'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reviewsApi.delete(id),
    onSuccess: () => {
      toast.success('Review deleted');
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['my-review'] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: (id: string) => reviewsApi.toggleLike(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviews'] }),
    onError: () => toast.error('Sign in to like reviews'),
  });

  const handleSubmitReview = useCallback(async (rating: number, comment: string) => {
    if (editingReview) {
      await updateMutation.mutateAsync({ id: editingReview.id, rating, comment });
    } else {
      await createMutation.mutateAsync({ rating, comment });
    }
    setEditingReview(null);
  }, [editingReview, updateMutation, createMutation]);

  const handleEdit = (r: Review) => { setEditingReview(r); setReviewModalOpen(true); };
  const handleDelete = (id: string) => { if (confirm('Delete your review?')) deleteMutation.mutate(id); };

  const SORT_OPTIONS = [
    { label: t('landing.reviews.sortNewest'), value: 'newest' },
    { label: t('landing.reviews.sortLiked'),  value: 'most_liked' },
    { label: t('landing.reviews.sortHighest'),value: 'highest' },
    { label: t('landing.reviews.sortLowest'), value: 'lowest' },
  ];

  const featureCards = [
    { icon: Shield,  titleKey: 'landing.features.f1Title', descKey: 'landing.features.f1Desc' },
    { icon: Zap,     titleKey: 'landing.features.f2Title', descKey: 'landing.features.f2Desc' },
    { icon: FolderOpen, titleKey: 'landing.features.f3Title', descKey: 'landing.features.f3Desc' },
    { icon: Share2,  titleKey: 'landing.features.f4Title', descKey: 'landing.features.f4Desc' },
    { icon: History, titleKey: 'landing.features.f5Title', descKey: 'landing.features.f5Desc' },
    { icon: Monitor, titleKey: 'landing.features.f6Title', descKey: 'landing.features.f6Desc' },
  ];

  const footerCols = [
    { titleKey: 'landing.footer.product', links: [
      { key: 'landing.footer.features', href: '#features' },
      { key: 'landing.footer.pricing',  href: '#pricing' },
      { key: 'landing.footer.security', href: '#' },
      { key: 'landing.footer.changelog',href: '/changelog' },
      { key: 'landing.footer.forum',    href: '/forum' },
    ]},
    { titleKey: 'landing.footer.company', links: [
      { key: 'landing.footer.about',   href: '/about' },
      { key: 'landing.footer.blog',    href: '#' },
      { key: 'landing.footer.careers', href: '#' },
      { key: 'landing.footer.press',   href: '#' },
    ]},
    { titleKey: 'landing.footer.support', links: [
      { key: 'landing.footer.helpCenter',   href: '#' },
      { key: 'landing.footer.contact',      href: '#' },
      { key: 'landing.footer.status',       href: '#' },
      { key: 'landing.footer.privacyPolicy',href: '#' },
    ]},
    { titleKey: 'landing.footer.legal', links: [
      { key: 'landing.footer.terms',   href: '#' },
      { key: 'landing.footer.privacy', href: '#' },
      { key: 'landing.footer.cookies', href: '#' },
      { key: 'landing.footer.gdpr',    href: '#' },
    ]},
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5]">
      {/* Navbar */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md border-b border-[#E5E5E5] dark:border-[#2A2A2A]' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#4F46E5] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" /></svg>
              </div>
              <span className="font-semibold text-sm tracking-tight text-[#0A0A0A] dark:text-[#F5F5F5]">CloudDrive</span>
            </Link>
            <Link to="/changelog" className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5] dark:text-[#6366f1] hover:bg-[#E0E7FF] dark:hover:bg-[#1e1b4b]/50 transition-colors">
              v2.0
            </Link>
            <OnlineIndicator />
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {(['features', 'pricing', 'reviews'] as const).map(item => (
              <button
                key={item}
                onClick={() => smoothScrollTo(item)}
                className={`px-3 py-2 text-sm transition-colors rounded-lg capitalize ${
                  activeSection === item
                    ? 'text-[#4F46E5] dark:text-[#6366f1] bg-[#EEF2FF] dark:bg-[#1e1b4b]/20'
                    : 'text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#141414]'
                }`}
              >
                {t(`landing.nav.${item}`) || item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
            <Link to="/forum" className="px-3 py-2 text-sm text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414]">
              Forum
            </Link>
            <Link to="/about" className="px-3 py-2 text-sm text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414]">
              {t('landing.nav.about') || 'About'}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden md:flex" />
            <button onClick={toggleTheme} className="hidden md:flex p-2 rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-all">
              {theme === 'dark' ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />}
            </button>
            {user ? (
              <Link to="/drive" className="hidden md:flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] rounded-lg hover:bg-[#1A1A1A] dark:hover:bg-white transition-colors">
                {t('landing.nav.openDrive')} <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden md:flex px-3 py-2 text-sm font-medium text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">{t('landing.nav.signIn')}</Link>
                <Link to="/register" className="hidden md:flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] rounded-lg hover:bg-[#1A1A1A] transition-colors">
                  {t('landing.nav.getStarted')} <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                </Link>
              </>
            )}
            <button className="md:hidden p-2 rounded-lg text-[#6B6B6B]" onClick={() => setMobileMenuOpen(v => !v)}>
              {mobileMenuOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-5 py-4 space-y-1 animate-fade-up">
            {(['features', 'pricing', 'reviews'] as const).map(item => (
              <button
                key={item}
                onClick={() => { smoothScrollTo(item); setMobileMenuOpen(false); }}
                className="block w-full text-left px-3 py-2.5 text-sm text-[#6B6B6B] dark:text-[#888888] rounded-lg capitalize hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors"
              >
                {t(`landing.nav.${item}`) || item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
            <Link to="/forum" className="block px-3 py-2.5 text-sm text-[#6B6B6B] dark:text-[#888888] rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414]" onClick={() => setMobileMenuOpen(false)}>Forum</Link>
            <Link to="/about" className="block px-3 py-2.5 text-sm text-[#6B6B6B] dark:text-[#888888] rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414]" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.about') || 'About'}</Link>
            <div className="pt-3 border-t border-[#E5E5E5] dark:border-[#2A2A2A] space-y-2">
              <div className="flex gap-2">
                <Link to="/login" className="flex-1 text-center px-4 py-2.5 text-sm font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg">{t('landing.nav.signIn')}</Link>
                <Link to="/register" className="flex-1 text-center px-4 py-2.5 text-sm font-medium bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] rounded-lg">{t('landing.nav.getStarted')}</Link>
              </div>
              <LanguageSwitcher className="flex" />
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-5 sm:px-8 pt-16 pb-24 text-center overflow-hidden">
        <ParticleBackground />

        <div className="relative z-10 flex flex-col items-center">
          <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E5E5E5] dark:border-[#2A2A2A] text-xs font-medium text-[#6B6B6B] dark:text-[#888888] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-pulse-accent" />
            {t('landing.hero.badge')}
            <ArrowRight className="w-3 h-3" strokeWidth={2} />
          </div>

          <AnimatedHeadline line1={t('landing.hero.headline')} line2={t('landing.hero.headlineAccent')} />

          <p className="animate-fade-up [animation-delay:120ms] max-w-lg text-lg sm:text-xl text-[#6B6B6B] dark:text-[#888888] mb-8 text-balance">
            {t('landing.hero.description')}
          </p>

          <div className="animate-fade-up [animation-delay:180ms] flex flex-col sm:flex-row items-center gap-3 mb-6">
            <Link to="/register" className="flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] rounded-xl hover:bg-[#1A1A1A] dark:hover:bg-white transition-all hover:scale-[1.02]">
              {t('landing.hero.cta')} <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
            <Link to="/login" className="flex items-center gap-2 px-6 py-3 text-sm font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA] transition-all">
              {t('landing.hero.ctaSignIn')}
            </Link>
          </div>

          <LiveCounter template={t('landing.hero.counter')} />

          <div className="animate-fade-up [animation-delay:280ms] flex flex-wrap items-center justify-center gap-6 text-xs text-[#AAAAAA] dark:text-[#444444] mt-6">
            {[
              { icon: '🔒', key: 'landing.hero.trust1' },
              { icon: '⚡', key: 'landing.hero.trust2' },
              { icon: '👥', key: 'landing.hero.trust3' },
            ].map(({ icon, key }) => (
              <span key={key} className="flex items-center gap-1.5"><span>{icon}</span>{t(key)}</span>
            ))}
          </div>

          <div className="animate-fade-up [animation-delay:360ms] w-full mt-20">
            <AppMockup />
          </div>
        </div>

        <ScrollIndicator />
      </section>

      {/* Features */}
      <section id="features" className="py-28 px-5 sm:px-8 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-3">{t('landing.features.badge')}</p>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{t('landing.features.title')}</h2>
            <p className="mt-4 text-lg text-[#6B6B6B] dark:text-[#888888] max-w-xl mx-auto">{t('landing.features.subtitle')}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featureCards.map(({ icon: Icon, titleKey, descKey }) => (
              <div
                key={titleKey}
                className="bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-7 group cursor-default transition-all duration-300 hover:-translate-y-1 hover:border-[#4F46E5] dark:hover:border-[#6366f1] hover:shadow-[0_8px_24px_rgba(79,70,229,0.12)]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center mb-5 group-hover:bg-[#4F46E5] transition-colors duration-300">
                  <Icon className="w-8 h-8 text-[#4F46E5] group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-[#0A0A0A] dark:text-[#F5F5F5] mb-2">{t(titleKey)}</h3>
                <p className="text-sm text-[#6B6B6B] dark:text-[#888888] leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <HowItWorksSection />

      {/* Pricing */}
      <PricingSection />

      {/* Reviews */}
      <section id="reviews" className="py-28 px-5 sm:px-8 bg-[#F8F8F8] dark:bg-[#141414] border-t border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-3">{t('landing.reviews.badge')}</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">{t('landing.reviews.title')}</h2>
              <p className="mt-2 text-[#6B6B6B] dark:text-[#888888]">{t('landing.reviews.subtitle')}</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-3">
              {totalCount > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{averageRating.toFixed(1)}</span>
                  <div>
                    <StarDisplay rating={Math.round(averageRating)} size="md" />
                    <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mt-0.5">
                      {t(totalCount !== 1 ? 'landing.reviews.basedOnPlural' : 'landing.reviews.basedOn', { count: totalCount })}
                    </p>
                  </div>
                </div>
              )}
              {user && (
                myReview ? (
                  <button onClick={() => handleEdit(myReview)} className="flex items-center gap-1.5 h-9 px-4 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors">
                    <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('landing.reviews.editReview')}
                  </button>
                ) : (
                  <button onClick={() => { setEditingReview(null); setReviewModalOpen(true); }} className="flex items-center gap-1.5 h-9 px-4 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors">
                    <Star className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('landing.reviews.writeReview')}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="flex items-center gap-1 flex-wrap">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setSort(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${sort === opt.value ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-[#E5E5E5] dark:bg-[#2A2A2A] hidden sm:block" />
            <div className="flex items-center gap-1 flex-wrap">
              {[0, 5, 4, 3, 2, 1].map(s => (
                <button key={s} onClick={() => setStarFilter(s === starFilter ? 0 : s)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${starFilter === s && s > 0 ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'}`}>
                  {s === 0 ? t('common.all') : <><Star className="w-3 h-3 fill-current" strokeWidth={0} />{s}★</>}
                </button>
              ))}
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-[#E5E5E5] dark:text-[#2A2A2A]">
                <rect x="4" y="12" width="48" height="36" rx="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 24h24M16 32h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{t('landing.reviews.noReviews')}</p>
              <p className="text-xs text-[#AAAAAA] dark:text-[#444444]">{t('landing.reviews.beFirst')}</p>
              {user && !myReview && (
                <button onClick={() => setReviewModalOpen(true)} className="flex items-center gap-1.5 h-9 px-4 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors">
                  <Star className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('landing.reviews.writeReview')}
                </button>
              )}
              {!user && (
                <Link to="/login" className="flex items-center gap-1.5 h-9 px-4 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F0F0F0] transition-colors">
                  {t('landing.reviews.signInToWrite')}
                </Link>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {reviews.map((r, i) => (
                <ReviewCard key={r.id} review={r} currentUserId={user?.id}
                  onLike={id => user ? likeMutation.mutate(id) : toast.error('Sign in to like reviews')}
                  onEdit={handleEdit} onDelete={handleDelete} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">{t('landing.cta.title')}</h2>
          <p className="text-lg text-[#6B6B6B] dark:text-[#888888] mb-10">{t('landing.cta.subtitle')}</p>
          <Link to="/register" className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl transition-all hover:scale-[1.02]">
            {t('landing.cta.button')} <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>
          <div className="mt-8 flex items-center justify-center gap-5 text-xs text-[#AAAAAA] dark:text-[#444444]">
            {(['trust1','trust2','trust3'] as const).map((key, i) => (
              <span key={key} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[#E5E5E5] dark:text-[#2A2A2A]">·</span>}
                <Check className="w-3 h-3 text-[#4F46E5]" strokeWidth={2.5} />
                {t(`landing.cta.${key}`)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQSection />

      {/* Footer */}
      <footer id="about" className="border-t border-[#E5E5E5] dark:border-[#2A2A2A] pt-16 pb-8 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Sitemap grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {footerCols.map(col => (
              <div key={col.titleKey}>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[#0A0A0A] dark:text-[#F5F5F5] mb-4">{t(col.titleKey)}</h3>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.key}>
                      {link.href.startsWith('/') ? (
                        <Link to={link.href} className="text-sm text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
                          {t(link.key)}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
                          {t(link.key)}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[#4F46E5] flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" /></svg>
              </div>
              <span className="text-sm font-medium text-[#6B6B6B] dark:text-[#888888]">CloudDrive</span>
            </div>
            <div className="flex items-center gap-3">
              <SocialButtons gradientId="ig-landing" />
              <button
                onClick={() => setDonateOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-400 dark:border-amber-600 text-amber-600 dark:text-amber-500 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
              >
                ☕ Support Us
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#AAAAAA] dark:text-[#444444] flex-wrap justify-center">
              <span>{t('landing.footer.copyright')}</span>
              <button onClick={toggleTheme} className="hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors flex items-center gap-1">
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Review Modal */}
      <ReviewModal
        open={reviewModalOpen}
        onClose={() => { setReviewModalOpen(false); setEditingReview(null); }}
        onSubmit={handleSubmitReview}
        existing={editingReview}
      />

      {/* Donate Modal */}
      {donateOpen && <DonateModal onClose={() => setDonateOpen(false)} />}
    </div>
  );
}
