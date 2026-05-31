import { useEffect, useState } from 'react';
import { Copy, Check, Link, Trash2, Eye, EyeOff, QrCode, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { File } from '@/types';
import { filesApi } from '@/api/files';
import { shareApi } from '@/api/share';
import toast from 'react-hot-toast';

interface ShareModalProps {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const EXPIRY_OPTIONS = [
  { label: 'Never', days: 0 },
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
];

export default function ShareModal({ file, open, onClose, onUpdate }: ShareModalProps) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareViews, setShareViews] = useState(0);
  const [expiryDays, setExpiryDays] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (open && file) {
      setShareToken(file.shareToken ?? null);
      setShareViews(file.shareViews ?? 0);
      setPassword('');
      setCopied(false);
      setShowQr(false);
      setQrCode(null);
    }
  }, [open, file]);

  useEffect(() => {
    if (showQr && shareToken && !qrCode) {
      shareApi.getQR(shareToken)
        .then(r => { if (r.success && r.data) setQrCode(r.data.qrCode); })
        .catch(() => null);
    }
  }, [showQr, shareToken, qrCode]);

  if (!file) return null;

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const opts: { expiresIn?: number; password?: string } = {};
      if (expiryDays > 0) opts.expiresIn = expiryDays * 86400;
      if (password.trim()) opts.password = password.trim();
      const res = await filesApi.createShareLink(file.id, opts);
      if (res.success && res.data) {
        setShareToken(res.data.shareToken);
        onUpdate();
        toast.success('Share link created!');
      }
    } catch {
      toast.error('Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await filesApi.removeShareLink(file.id);
      setShareToken(null);
      setQrCode(null);
      setShowQr(false);
      onUpdate();
      toast.success('Share link removed');
    } catch {
      toast.error('Failed to remove share link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.5} />
            Share "{file.name}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {shareToken ? (
            <>
              {/* Stats row */}
              <div className="flex items-center gap-3 text-xs text-[#6B6B6B] dark:text-[#888888]">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" strokeWidth={1.5} />
                  Viewed {shareViews} {shareViews === 1 ? 'time' : 'times'}
                </span>
                <span className="text-[#10B981] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Link active
                </span>
              </div>

              {/* Share URL */}
              <div className="flex items-center gap-2 p-3 bg-[#F8F8F8] dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg">
                <p className="flex-1 text-xs text-[#6B6B6B] dark:text-[#888888] truncate font-mono">{shareUrl}</p>
                <a href={shareUrl!} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-[#E5E5E5] dark:hover:bg-[#2A2A2A] transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-[#AAAAAA]" strokeWidth={1.5} />
                </a>
                <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-[#E5E5E5] dark:hover:bg-[#2A2A2A] transition-colors">
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-green-500" strokeWidth={2} />
                    : <Copy className="w-3.5 h-3.5 text-[#6B6B6B] dark:text-[#888888]" strokeWidth={1.5} />
                  }
                </button>
              </div>

              {/* QR code toggle */}
              <button
                onClick={() => setShowQr(v => !v)}
                className="flex items-center gap-2 text-xs text-[#4F46E5] hover:text-[#4338CA] transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" strokeWidth={1.5} />
                {showQr ? 'Hide QR code' : 'Show QR code'}
              </button>

              {showQr && (
                <div className="flex justify-center py-2">
                  {qrCode
                    ? <img src={qrCode} alt="QR code" className="w-36 h-36 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A]" />
                    : <div className="w-36 h-36 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
                      </div>
                  }
                </div>
              )}

              {/* Revoke */}
              <button
                onClick={handleRemove}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                Revoke link
              </button>
            </>
          ) : (
            <>
              {/* Expiry */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444]">
                  Expires
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {EXPIRY_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setExpiryDays(opt.days)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                        expiryDays === opt.days
                          ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30'
                          : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444]">
                  Password (optional)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Leave empty for no password"
                    className="w-full bg-transparent border-b border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5] dark:focus:border-[#6366f1] pb-2 pr-8 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-0 bottom-2 text-[#AAAAAA] hover:text-[#6B6B6B] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full h-9 text-sm font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40"
              >
                {loading ? 'Creating…' : 'Create share link'}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
