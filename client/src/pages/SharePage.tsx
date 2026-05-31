import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Lock, File, AlertCircle, Cloud } from 'lucide-react';
import { shareApi } from '@/api/share';
import { ShareInfo } from '@/types';
import { formatFileSize } from '@/lib/utils';

function FileIcon({ mimeType }: { mimeType: string }) {
  const base = 'text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide';
  if (mimeType.startsWith('image/')) return <span className={`${base} bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400`}>IMG</span>;
  if (mimeType === 'application/pdf') return <span className={`${base} bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400`}>PDF</span>;
  if (mimeType.startsWith('video/')) return <span className={`${base} bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400`}>VID</span>;
  if (mimeType.startsWith('audio/')) return <span className={`${base} bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400`}>AUD</span>;
  return <span className={`${base} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`}>FILE</span>;
}

function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  if (d < now) return 'Expired';
  const diffMs = d.getTime() - now.getTime();
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 24) return `${diffHrs}h remaining`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d remaining`;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['share', token],
    queryFn: () => shareApi.getInfo(token!),
    enabled: !!token,
    retry: false,
  });

  const info: ShareInfo | undefined = data?.data;
  const isExpired = info?.shareExpires ? new Date(info.shareExpires) < new Date() : false;

  const needsPassword = info?.hasPassword && !passwordSubmitted;

  const handleDownload = async () => {
    if (!token) return;
    setError('');
    setDownloading(true);
    try {
      const url = shareApi.getDownloadUrl(token);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: info?.hasPassword ? password : undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Download failed. Check your password.');
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = info?.name ?? 'download';
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setPasswordSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-6 py-4">
        <a href="/" className="flex items-center gap-2 w-fit">
          <div className="w-6 h-6 rounded-md bg-[#4F46E5] flex items-center justify-center">
            <Cloud className="w-3.5 h-3.5 text-white" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] tracking-tight">CloudDrive</span>
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {isLoading && (
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">Loading file info…</p>
            </div>
          )}

          {isError && (
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-8 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-500" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-1">Link not found</h2>
              <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">This share link is invalid or has been removed.</p>
            </div>
          )}

          {info && isExpired && (
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-8 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-1">Link expired</h2>
              <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">This share link has expired and is no longer available.</p>
            </div>
          )}

          {info && !isExpired && needsPassword && (
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-8 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-[#4F46E5]" strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-1 text-center">Password protected</h2>
              <p className="text-sm text-[#6B6B6B] dark:text-[#888888] text-center mb-6">
                Enter the password to access <span className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{info.name}</span>
              </p>
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!password.trim()}
                  className="w-full h-10 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  Continue
                </button>
              </form>
            </div>
          )}

          {info && !isExpired && !needsPassword && (
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-8 shadow-sm">
              {/* File info */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-[#F0F0F0] dark:bg-[#252525] flex items-center justify-center shrink-0">
                  <File className="w-7 h-7 text-[#6B6B6B] dark:text-[#888888]" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{info.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <FileIcon mimeType={info.mimeType} />
                    <span className="text-xs text-[#AAAAAA] dark:text-[#444444]">{formatFileSize(info.size)}</span>
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="space-y-2 mb-6 pb-6 border-b border-[#F0F0F0] dark:border-[#1E1E1E]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#AAAAAA] dark:text-[#444444]">Shared by</span>
                  <span className="text-[#0A0A0A] dark:text-[#F5F5F5] font-medium">{info.uploaderName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#AAAAAA] dark:text-[#444444]">Expires</span>
                  <span className={`font-medium ${info.shareExpires ? 'text-amber-500' : 'text-[#0A0A0A] dark:text-[#F5F5F5]'}`}>
                    {formatExpiry(info.shareExpires)}
                  </span>
                </div>
                {info.hasPassword && (
                  <div className="flex items-center gap-1.5 text-xs text-[#6B6B6B] dark:text-[#888888]">
                    <Lock className="w-3 h-3" strokeWidth={1.5} />
                    <span>Password protected</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  {error}
                </div>
              )}

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full h-11 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Downloading…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                    Download file
                  </>
                )}
              </button>

              <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444] text-center mt-3">
                Shared via{' '}
                <a href="/" className="text-[#4F46E5] hover:underline">CloudDrive</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
