import { Link } from 'react-router-dom';
import { XCircle, HardDrive } from 'lucide-react';

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 bg-[#F0F0F0] dark:bg-[#1E1E1E] rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-[#AAAAAA] dark:text-[#444444]" />
        </div>

        <h1 className="text-2xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] mb-3">
          Payment cancelled
        </h1>
        <p className="text-[#6B6B6B] dark:text-[#888888] mb-8">
          No charges were made. You can upgrade your plan anytime from your drive.
        </p>

        <Link
          to="/drive"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#4F46E5] text-white font-medium hover:bg-[#4338ca] transition-colors"
        >
          <HardDrive className="w-4 h-4" />
          Back to My Drive
        </Link>
      </div>
    </div>
  );
}
