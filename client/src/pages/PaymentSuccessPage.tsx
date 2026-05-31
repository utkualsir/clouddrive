import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, HardDrive } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

// Simple confetti component
function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    color: ['#4F46E5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'][Math.floor(Math.random() * 5)],
    size: 6 + Math.floor(Math.random() * 8),
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute top-0 animate-confetti-fall"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        >
          <div
            style={{ width: p.size, height: p.size, backgroundColor: p.color, borderRadius: 2 }}
          />
        </div>
      ))}
    </div>
  );
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [showConfetti, setShowConfetti] = useState(true);
  void searchParams;

  useEffect(() => {
    // Invalidate payment status and user queries so they reflect upgraded plan
    qc.invalidateQueries({ queryKey: ['payment-status'] });
    qc.invalidateQueries({ queryKey: ['storage-stats'] });

    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [qc]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex items-center justify-center px-4 relative">
      {showConfetti && <Confetti />}

      <div className="relative z-10 text-center max-w-md w-full">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>

        <h1 className="text-2xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] mb-3">
          Your plan has been upgraded!
        </h1>
        <p className="text-[#6B6B6B] dark:text-[#888888] mb-2">
          Welcome to your new plan. Your storage limit has been updated immediately.
        </p>
        <p className="text-sm text-[#AAAAAA] dark:text-[#444444] mb-8">
          You can manage your subscription anytime from Settings → Billing.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/drive"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#4F46E5] text-white font-medium hover:bg-[#4338ca] transition-colors"
          >
            <HardDrive className="w-4 h-4" />
            Go to My Drive
          </Link>
          <Link
            to="/settings?tab=billing"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors"
          >
            View Billing
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}
