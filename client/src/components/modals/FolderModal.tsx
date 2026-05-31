import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const COLORS = ['#4F46E5', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#14B8A6', '#3B82F6', '#6B7280'];

interface FolderModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string) => Promise<void>;
  initialName?: string;
  initialColor?: string;
  title?: string;
}

export default function FolderModal({ open, onClose, onSubmit, initialName = '', initialColor = '#4F46E5', title = 'New folder' }: FolderModalProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit(name.trim(), color);
      setName('');
      setColor('#4F46E5');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Name input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444]">
              Name
            </label>
            <input
              type="text"
              placeholder="My Folder"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full bg-transparent border-b border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5] dark:focus:border-[#6366f1] pb-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none transition-colors duration-150"
            />
          </div>

          {/* Color swatches */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444]">
              Color
            </label>
            <div className="flex gap-2 flex-wrap pt-0.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : 'none',
                    transform: color === c ? 'scale(1.15)' : undefined,
                  }}
                />
              ))}
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
              disabled={!name.trim() || loading}
              className="flex-1 h-9 text-sm font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving…' : title === 'New folder' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
