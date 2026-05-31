import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Review } from '@/types';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  existing?: Review | null;
}

export default function ReviewModal({ open, onClose, onSubmit, existing }: ReviewModalProps) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setRating(existing?.rating ?? 0);
      setComment(existing?.comment ?? '');
      setHovered(0);
    }
  }, [open, existing]);

  const canSubmit = rating > 0 && comment.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onSubmit(rating, comment.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit your review' : 'Share your experience'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Star selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444]">
              Rating
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-7 h-7 transition-colors duration-100 ${
                      star <= (hovered || rating)
                        ? 'text-[#4F46E5] fill-[#4F46E5]'
                        : 'text-[#E5E5E5] dark:text-[#2A2A2A]'
                    }`}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-[#6B6B6B] dark:text-[#888888]">
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444]">
              Your review
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 500))}
              placeholder="Tell others what you think about CloudDrive..."
              rows={4}
              className="w-full bg-transparent border border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5] dark:focus:border-[#6366f1] rounded-lg px-3 py-2.5 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none transition-colors duration-150 resize-none"
            />
            <div className="flex justify-between items-center">
              {comment.trim().length > 0 && comment.trim().length < 10 && (
                <p className="text-[11px] text-red-500">At least 10 characters required</p>
              )}
              <p className={`text-[11px] ml-auto ${comment.length >= 480 ? 'text-red-500' : 'text-[#AAAAAA] dark:text-[#444444]'}`}>
                {comment.length} / 500
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 text-sm font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="flex-1 h-9 text-sm font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Posting…' : existing ? 'Update review' : 'Post review'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
