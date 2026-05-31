import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { HardDrive, Clock, Star, Trash2, Settings, LogOut, RefreshCw, BarChart2, User, Users, UserSearch, FolderOpen, Plus, Edit2, Bell, MessageSquare, MessagesSquare, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storageApi } from '@/api/storage';
import { folderShareApi, SharedFolderEntry } from '@/api/payments';
import { tagsApi } from '@/api/tags';
import { notificationsApi } from '@/api/notifications';
import { conversationsApi } from '@/api/conversations';
import { Tag } from '@/types';
import SocialButtons from '@/components/SocialButtons';
import FolderTree, { DragItem } from '@/components/layout/FolderTree';
import DonateModal from '@/components/modals/DonateModal';
import { useTranslation } from 'react-i18next';
import { useWebSocket } from '@/contexts/WebSocketContext';

const viewIds = [
  { id: 'drive',   icon: HardDrive, key: 'nav.myDrive'  },
  { id: 'recent',  icon: Clock,     key: 'nav.recent'   },
  { id: 'starred', icon: Star,      key: 'nav.starred'  },
  { id: 'trash',   icon: Trash2,    key: 'nav.trash'    },
];

const PLAN_COLORS: Record<string, string> = {
  free:    '#6B6B6B',
  '100gb': '#4F46E5',
  '200gb': '#4F46E5',
  '500gb': '#7c3aed',
  '1tb':   '#7c3aed',
  '2tb':   '#6d28d9',
  // legacy
  pro:      '#4F46E5',
  business: '#7c3aed',
};

const PLAN_NAMES: Record<string, string> = {
  free:    'Free Plan',
  '100gb': '100 GB Plan',
  '200gb': '200 GB Plan',
  '500gb': '500 GB Plan',
  '1tb':   '1 TB Plan',
  '2tb':   '2 TB Plan',
};

const PERM_COLORS: Record<string, string> = {
  VIEW:   '#6B6B6B',
  UPLOAD: '#3b82f6',
  MANAGE: '#4F46E5',
};

const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onSharedFolderOpen?: (entry: SharedFolderEntry) => void;
  onTagFilter?: (tagId: string | null) => void;
  activeTagId?: string | null;
  currentFolderId?: string | null;
  onNavigateToFolder?: (folderId: string, folderName: string) => void;
  draggingItem?: DragItem | null;
  onDropToFolder?: (targetFolderId: string, targetFolderName: string) => void;
  folderTreeRefreshKey?: number;
}

export default function Sidebar({ currentView, onViewChange, onSharedFolderOpen, onTagFilter, activeTagId, currentFolderId, onNavigateToFolder, draggingItem, onDropToFolder, folderTreeRefreshKey }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { unreadBump, messageBump } = useWebSocket();

  const [donateOpen, setDonateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState('#6366f1');
  const [ctxTag, setCtxTag] = useState<{ tag: Tag; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<{ tag: Tag; name: string } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxTag) return;
    const fn = (e: MouseEvent) => { if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxTag(null); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ctxTag]);

  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.getAll(), enabled: !!user });

  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ['notif-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const unreadCount = unreadData?.data?.count ?? 0;

  const { data: msgUnreadData, refetch: refetchMsgUnread } = useQuery({
    queryKey: ['msg-unread-count'],
    queryFn: () => conversationsApi.getUnreadCount(),
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const msgUnreadCount = msgUnreadData?.data?.count ?? 0;

  useEffect(() => {
    if (unreadBump > 0) refetchUnread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadBump]);

  useEffect(() => {
    if (messageBump > 0) refetchMsgUnread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageBump]);
  const tags = tagsData?.data ?? [];

  const createTagMutation = useMutation({
    mutationFn: () => tagsApi.create(createName.trim(), createColor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); setCreateOpen(false); setCreateName(''); setCreateColor('#6366f1'); },
  });
  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => tagsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); qc.invalidateQueries({ queryKey: ['files'] }); if (activeTagId === ctxTag?.tag.id) onTagFilter?.(null); setCtxTag(null); },
  });
  const updateTagMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => tagsApi.update(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); setRenaming(null); },
  });

  const { data: statsData } = useQuery({
    queryKey: ['storage-stats'],
    queryFn: () => storageApi.getStats(),
    enabled: !!user,
  });

  const { data: sharedData } = useQuery({
    queryKey: ['shared-with-me'],
    queryFn: () => folderShareApi.getSharedWithMe(),
    enabled: !!user,
  });

  const stats = statsData?.data;
  const pct = stats?.percentage ?? 0;
  const sharedFolders: SharedFolderEntry[] = sharedData?.data ?? [];
  const plan = user?.plan ?? 'free';
  const planColor = PLAN_COLORS[plan] ?? '#6B6B6B';

  const handleLogout = () => { logout(); navigate('/'); };

  const navLinkClass = (isActive: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 text-left ${
      isActive
        ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 text-[#4F46E5] dark:text-[#6366f1] font-medium'
        : 'text-[#374151] dark:text-[#888888] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] hover:text-[#111827] dark:hover:text-[#F5F5F5] font-normal'
    }`;
  const navLinkStyle = (isActive: boolean) =>
    isActive ? { borderLeft: '2px solid #4F46E5', paddingLeft: 'calc(0.75rem - 2px)' } : {};

  return (
    <aside className="w-60 h-full flex flex-col bg-white dark:bg-[#0A0A0A] border-r border-[#E5E7EB] dark:border-[#2A2A2A]">
      {/* Logo + version */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <Link to="/" className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-md bg-[#4F46E5] flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#0A0A0A] dark:text-[#F5F5F5]">CloudDrive</span>
        </Link>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] shrink-0">v2.0</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {viewIds.map(({ id, icon: Icon, key }) => {
          const active = currentView === id;
          return (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={navLinkClass(active)}
              style={navLinkStyle(active)}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.5} />
              {t(key)}
            </button>
          );
        })}

        {/* Folder tree */}
        {onNavigateToFolder && (
          <FolderTree
            currentFolderId={currentFolderId ?? null}
            onNavigate={onNavigateToFolder}
            draggingItem={draggingItem ?? null}
            onDropToFolder={onDropToFolder ?? (() => undefined)}
            refreshKey={folderTreeRefreshKey}
          />
        )}

        {/* Friends link */}
        <NavLink
          to="/friends"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <Users className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          {t('nav.friends')}
        </NavLink>

        {/* Notifications link */}
        <NavLink
          to="/notifications"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <Bell className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span className="flex-1">Notifications</span>
          {unreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </NavLink>

        {/* Messages link */}
        <NavLink
          to="/messages"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <MessageSquare className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span className="flex-1">Messages</span>
          {msgUnreadCount > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#4F46E5] text-white text-[10px] font-bold leading-none">
              {msgUnreadCount > 99 ? '99+' : msgUnreadCount}
            </span>
          )}
        </NavLink>

        {/* Forum link */}
        <NavLink
          to="/forum"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <MessagesSquare className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          Forum
        </NavLink>

        {/* Search link */}
        <NavLink
          to="/search"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <Search className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          Search
        </NavLink>

        {/* Find People link */}
        <NavLink
          to="/search/users"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <UserSearch className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          Find People
        </NavLink>

        {/* Tags section */}
        <div className="pt-3">
          <div className="flex items-center justify-between px-3 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#555555]">Tags</p>
            <button
              onClick={() => setCreateOpen(v => !v)}
              className="p-0.5 rounded text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-all"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
          {createOpen && (
            <div className="px-3 mb-2">
              <input
                autoFocus
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && createName.trim()) createTagMutation.mutate();
                  if (e.key === 'Escape') { setCreateOpen(false); setCreateName(''); }
                }}
                placeholder="Tag name..."
                className="w-full h-6 px-2 text-xs bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] outline-none focus:border-[#4F46E5] mb-1.5"
              />
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCreateColor(c)}
                    className={`w-4 h-4 rounded-full transition-all ${createColor === c ? 'ring-2 ring-offset-1 ring-[#4F46E5] dark:ring-offset-[#0A0A0A]' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => onTagFilter?.(activeTagId === tag.id ? null : tag.id)}
              onContextMenu={e => { e.preventDefault(); setCtxTag({ tag, x: e.clientX, y: e.clientY }); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all duration-150 text-left ${
                activeTagId === tag.id
                  ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 text-[#4F46E5] dark:text-[#6366f1] font-medium'
                  : 'text-[#374151] dark:text-[#888888] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E]'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 truncate">{tag.name}</span>
              {tag.fileCount !== undefined && <span className="text-[10px] text-[#9CA3AF] dark:text-[#555555]">{tag.fileCount}</span>}
            </button>
          ))}
          {tags.length === 0 && !createOpen && (
            <p className="px-3 py-1.5 text-[11px] text-[#9CA3AF] dark:text-[#555555]">No tags yet</p>
          )}
        </div>

        {/* Shared with me section */}
        {sharedFolders.length > 0 && (
          <div className="pt-2">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#555555]">
              {t('nav.sharedWithMe')}
            </p>
            {sharedFolders.map(entry => (
              <button
                key={entry.shareId}
                onClick={() => onSharedFolderOpen?.(entry)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-all duration-150 text-left text-[#374151] dark:text-[#888888] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] hover:text-[#111827] dark:hover:text-[#F5F5F5] group"
              >
                <div className="relative shrink-0">
                  <FolderOpen
                    className="w-4 h-4"
                    strokeWidth={1.5}
                    style={{ color: entry.folder.color }}
                  />
                  <div
                    className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                    style={{ backgroundColor: entry.owner.avatarColor, fontSize: 8 }}
                  >
                    {entry.owner.displayName[0]?.toUpperCase()}
                  </div>
                </div>
                <span className="flex-1 truncate text-xs">{entry.folder.name}</span>
                <span
                  className="text-[9px] font-semibold px-1 py-0.5 rounded shrink-0"
                  style={{ color: PERM_COLORS[entry.permission] ?? '#6B6B6B', backgroundColor: (PERM_COLORS[entry.permission] ?? '#6B6B6B') + '20' }}
                >
                  {entry.permission}
                </span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Profile link */}
      {user && (
        <div className="px-3 pb-1">
          <NavLink
            to={`/profile/${user.id}`}
            className={({ isActive }) => navLinkClass(isActive)}
            style={({ isActive }) => navLinkStyle(isActive)}
          >
            <User className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            {t('nav.profile')}
          </NavLink>
        </div>
      )}

      {/* Tools section */}
      <div className="px-3 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#555555]">{t('nav.tools')}</p>
        <NavLink
          to="/stats"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <BarChart2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          {t('nav.stats')}
        </NavLink>
        <NavLink
          to="/tools/convert"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <RefreshCw className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          {t('nav.fileConverter')}
        </NavLink>
        <NavLink
          to="/changelog"
          className={({ isActive }) => navLinkClass(isActive)}
          style={({ isActive }) => navLinkStyle(isActive)}
        >
          <Sparkles className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span className="flex-1">What's new</span>
          <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5] dark:text-[#6366f1]">v2.0.0</span>
        </NavLink>
      </div>

      {/* Bottom section */}
      <div className="px-5 pb-5 pt-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] space-y-4">
        {/* Storage meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#374151] dark:text-[#888888]">
              {PLAN_NAMES[plan] ?? t('storage.storage')}
            </span>
            {plan === 'free' && (
              <NavLink
                to="/settings?tab=billing"
                className="text-[10px] font-medium text-[#4F46E5] hover:underline"
              >
                Upgrade ↗
              </NavLink>
            )}
          </div>
          <div className="h-[3px] bg-[#E5E7EB] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: pct > 95 ? '#EF4444' : pct > 80 ? '#f59e0b' : '#4F46E5',
              }}
            />
          </div>
          <p className="text-[11px] text-[#6B7280] dark:text-[#555555]">
            {stats ? `${stats.storageUsedFormatted} of ${stats.storageLimitFormatted}` : '— of 5 GB'}
          </p>
        </div>

        {/* User row */}
        <div className="flex items-center gap-2.5 pt-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ backgroundColor: user?.avatarColor ?? '#4F46E5' }}
          >
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{user?.displayName}</p>
              {plan !== 'free' && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: planColor + '20', color: planColor }}
                >
                  {plan.charAt(0).toUpperCase() + plan.slice(1)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6B7280] dark:text-[#555555] truncate">{user?.email}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <NavLink
              to="/settings"
              className="p-1.5 rounded-md text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-all duration-150"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
            </NavLink>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-[#6B7280] dark:text-[#555555] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-150"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Social links */}
        <div className="flex justify-center pt-1">
          <SocialButtons gradientId="ig-sidebar" />
        </div>

        {/* Donate button */}
        <button
          onClick={() => setDonateOpen(true)}
          className="w-full py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-800/30 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
        >
          ☕ Support
        </button>
      </div>

      {donateOpen && <DonateModal onClose={() => setDonateOpen(false)} />}
      {ctxTag && (
        <div
          ref={ctxRef}
          className="fixed z-[200] min-w-[140px] bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg shadow-lg p-1"
          style={{ top: Math.min(ctxTag.y, window.innerHeight - 100), left: Math.min(ctxTag.x, window.innerWidth - 160) }}
        >
          <button
            onClick={() => { setRenaming({ tag: ctxTag.tag, name: ctxTag.tag.name }); setCtxTag(null); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]"
          >
            <Edit2 className="w-3 h-3" strokeWidth={1.5} /> Rename
          </button>
          <button
            onClick={() => { if (confirm(`Delete tag "${ctxTag.tag.name}"?`)) deleteTagMutation.mutate(ctxTag.tag.id); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.5} /> Delete
          </button>
        </div>
      )}

      {renaming && (
        <div className="fixed z-[200] inset-0 flex items-center justify-center bg-black/20 dark:bg-black/40">
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-xl p-4 w-56">
            <p className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] mb-2">Rename tag</p>
            <input
              autoFocus
              value={renaming.name}
              onChange={e => setRenaming({ ...renaming, name: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter' && renaming.name.trim()) updateTagMutation.mutate({ id: renaming.tag.id, name: renaming.name.trim() });
                if (e.key === 'Escape') setRenaming(null);
              }}
              className="w-full h-7 px-2 text-xs bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded text-[#0A0A0A] dark:text-[#F5F5F5] outline-none focus:border-[#4F46E5] mb-3"
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => renaming.name.trim() && updateTagMutation.mutate({ id: renaming.tag.id, name: renaming.name.trim() })}
                className="flex-1 py-1.5 text-[11px] font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setRenaming(null)}
                className="flex-1 py-1.5 text-[11px] font-medium text-[#6B6B6B] bg-[#F3F4F6] dark:bg-[#1E1E1E] rounded-lg transition-colors hover:bg-[#E5E7EB] dark:hover:bg-[#252525]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
