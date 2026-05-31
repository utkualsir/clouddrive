import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Folder } from '@/types';
import { folderShareApi, FolderShareEntry } from '@/api/payments';
import { friendsApi, FriendUser } from '@/api/friends';
import toast from 'react-hot-toast';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const PERMISSIONS = ['VIEW', 'UPLOAD', 'MANAGE'] as const;
type Permission = typeof PERMISSIONS[number];

const PERM_COLORS: Record<Permission, string> = {
  VIEW:   '#6B6B6B',
  UPLOAD: '#3b82f6',
  MANAGE: '#4F46E5',
};

interface ShareFolderModalProps {
  folder: Folder | null;
  open: boolean;
  onClose: () => void;
}

export default function ShareFolderModal({ folder, open, onClose }: ShareFolderModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [shares, setShares] = useState<FolderShareEntry[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<Permission>('VIEW');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open && folder) {
      setQuery('');
      setResults([]);
      setSelectedPermission('VIEW');
      folderShareApi.getShares(folder.id).then(r => {
        if (r.success && r.data) setShares(r.data);
      }).catch(() => null);
    }
  }, [open, folder]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await friendsApi.searchUsers(query);
        if (res.success && res.data) setResults(res.data);
      } catch { /* ignore */ } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  const handleShare = async (userId: string) => {
    if (!folder) return;
    setSubmitting(true);
    try {
      await folderShareApi.shareFolder(folder.id, userId, selectedPermission);
      toast.success('Folder shared');
      const r = await folderShareApi.getShares(folder.id);
      if (r.success && r.data) setShares(r.data);
      setQuery('');
      setResults([]);
    } catch {
      toast.error('Failed to share folder');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!folder) return;
    try {
      await folderShareApi.removeShare(folder.id, userId);
      setShares(prev => prev.filter(s => s.sharedWithId !== userId));
      toast.success('Access removed');
    } catch {
      toast.error('Failed to remove access');
    }
  };

  const alreadySharedIds = new Set(shares.map(s => s.sharedWithId));
  const filteredResults = results.filter(u => !alreadySharedIds.has(u.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            Share "{folder?.name}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Search + permission row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AAAAAA] dark:text-[#444444] pointer-events-none" strokeWidth={1.5} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search people…"
                className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#AAAAAA] dark:placeholder-[#444444] focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
              {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#AAAAAA] animate-spin" strokeWidth={1.5} />}
            </div>
            <select
              value={selectedPermission}
              onChange={e => setSelectedPermission(e.target.value as Permission)}
              className="h-8 px-2 text-xs rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5]"
            >
              {PERMISSIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Search results */}
          {filteredResults.length > 0 && (
            <div className="border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg overflow-hidden">
              {filteredResults.map(user => (
                <div key={user.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.avatarUrl ? (
                      <img src={`${apiBase}${user.avatarUrl}`} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      user.displayName[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{user.displayName}</p>
                    <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444] truncate">@{user.username}</p>
                  </div>
                  <button
                    onClick={() => handleShare(user.id)}
                    disabled={submitting}
                    className="shrink-0 flex items-center gap-1 h-6 px-2 text-[11px] font-medium bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 text-white rounded-md transition-colors"
                  >
                    <UserPlus className="w-3 h-3" strokeWidth={1.5} />
                    Share
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Current shares */}
          {shares.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444] mb-2">People with access</p>
              <div className="space-y-1">
                {shares.map(share => {
                  const u = share.sharedWith;
                  const perm = share.permission as Permission;
                  return (
                    <div key={share.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414]">
                      {u && (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                          style={{ backgroundColor: u.avatarColor }}
                        >
                          {u.avatarUrl ? (
                            <img src={`${apiBase}${u.avatarUrl}`} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            u.displayName[0]?.toUpperCase()
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{u?.displayName ?? 'Unknown'}</p>
                      </div>
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: PERM_COLORS[perm] ?? '#6B6B6B', backgroundColor: (PERM_COLORS[perm] ?? '#6B6B6B') + '20' }}
                      >
                        {perm}
                      </span>
                      <button
                        onClick={() => handleRemove(share.sharedWithId)}
                        className="shrink-0 p-1 rounded-md text-[#AAAAAA] dark:text-[#444444] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {shares.length === 0 && !query && (
            <p className="text-xs text-center text-[#AAAAAA] dark:text-[#444444] py-3">
              Not shared with anyone yet. Search for people above.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
