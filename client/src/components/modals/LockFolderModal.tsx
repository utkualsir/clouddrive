import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Folder } from '@/types';

interface LockFolderModalProps {
  folder: Folder | null;
  mode: 'lock' | 'unlock';
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}

export default function LockFolderModal({ folder, mode, open, onClose, onSubmit }: LockFolderModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      await onSubmit(password);
      setPassword('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setPassword(''); onClose(); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'lock'
              ? <Lock className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.5} />
              : <Unlock className="w-4 h-4 text-[#10B981]" strokeWidth={1.5} />
            }
            {mode === 'lock' ? 'Lock folder' : 'Unlock folder'}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-[#6B6B6B] dark:text-[#888888] -mt-1">
          {mode === 'lock'
            ? `Set a password to protect "${folder?.name}".`
            : `Enter the password for "${folder?.name}".`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444]">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'lock' ? 'Min. 4 characters' : 'Enter password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                className="w-full bg-transparent border-b border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5] dark:focus:border-[#6366f1] pb-2 pr-8 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none transition-colors duration-150"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-0 bottom-2 text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] dark:hover:text-[#888888] transition-colors"
              >
                {showPassword
                  ? <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                  : <Eye className="w-4 h-4" strokeWidth={1.5} />
                }
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 h-9 text-sm font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || loading}
              className="flex-1 h-9 text-sm font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Working…' : mode === 'lock' ? 'Lock' : 'Unlock'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
