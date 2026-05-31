import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Grid, List, Sun, Moon, Upload, SortAsc, SortDesc, Menu, ChevronDown, Folder as FolderIcon, FileText, Clock, X, Bell, Check } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ViewMode, SortField, SortOrder, SearchResults, AppNotification } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ActivityFeed from '@/components/ActivityFeed';
import { searchApi } from '@/api/search';
import { usersApi } from '@/api/users';
import { notificationsApi } from '@/api/notifications';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const LS_KEY = 'clouddrive-search-history';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onUploadClick: () => void;
  onMenuClick: () => void;
  title: string;
  uploadDisabled?: boolean;
}

const sortLabels: Record<SortField, string> = {
  name: 'Name',
  createdAt: 'Date',
  size: 'Size',
};

function getLocalHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function saveLocalHistory(h: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(h));
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { unreadBump } = useWebSocket();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: countData, refetch: refetchCount } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: notifsData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notifs-dropdown'],
    queryFn: () => notificationsApi.getAll({ limit: 15 }),
    enabled: !!user && open,
  });

  // Bump refetch when WS delivers a new notification
  useEffect(() => {
    if (unreadBump > 0) {
      refetchCount();
      if (open) refetchNotifs();
    }
  }, [unreadBump, open, refetchCount, refetchNotifs]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-count'] }); qc.invalidateQueries({ queryKey: ['notifs-dropdown'] }); },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-count'] }); qc.invalidateQueries({ queryKey: ['notifs-dropdown'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-count'] }); qc.invalidateQueries({ queryKey: ['notifs-dropdown'] }); },
  });

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const handleNotifClick = (n: AppNotification) => {
    if (!n.read) markReadMutation.mutate(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  const count = countData?.data?.count ?? 0;
  const allNotifs: AppNotification[] = notifsData?.data?.notifications ?? [];
  const displayed = filter === 'unread' ? allNotifs.filter(n => !n.read) : allNotifs;

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] dark:hover:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-all"
      >
        <Bell className="w-4 h-4" strokeWidth={1.5} />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-h-[480px] z-[300] bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col animate-modal-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E] shrink-0">
            <span className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Notifications</span>
            <button
              onClick={() => markAllMutation.mutate()}
              className="text-[10px] text-[#4F46E5] hover:underline flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Mark all read
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0 px-4 pt-2 shrink-0">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  filter === f
                    ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 text-[#4F46E5] dark:text-[#6366f1]'
                    : 'text-[#6B7280] dark:text-[#555555] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-1">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell className="w-7 h-7 text-[#E5E5E5] dark:text-[#2A2A2A]" strokeWidth={1} />
                <p className="text-xs text-[#AAAAAA] dark:text-[#555555]">
                  {filter === 'unread' ? 'No unread notifications' : "You're all caught up!"}
                </p>
              </div>
            ) : (
              displayed.map(n => (
                <div
                  key={n.id}
                  className={`relative flex items-start gap-3 px-4 py-3 hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A] cursor-pointer group transition-colors ${!n.read ? 'bg-[#EEF2FF]/40 dark:bg-[#1e1b4b]/10' : ''}`}
                  onClick={() => handleNotifClick(n)}
                >
                  {/* Unread dot */}
                  {!n.read && <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0" />}

                  {/* Avatar / system icon */}
                  {n.from ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: n.from.avatarColor }}
                    >
                      {n.from.displayName[0]?.toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#F0F0F0] dark:bg-[#2A2A2A] flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-[#6B7280] dark:text-[#555555]" strokeWidth={1.5} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${!n.read ? 'text-[#0A0A0A] dark:text-[#F5F5F5]' : 'text-[#374151] dark:text-[#888888]'}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-[#AAAAAA] dark:text-[#555555] mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteMutation.mutate(n.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#AAAAAA] hover:text-red-500 transition-all shrink-0"
                  >
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[#F0F0F0] dark:border-[#1E1E1E] px-4 py-2.5 shrink-0">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-[#4F46E5] hover:underline font-medium"
            >
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({
  viewMode, onViewModeChange, sortField, sortOrder, onSortChange,
  searchQuery, onSearchChange, onUploadClick, onMenuClick, title, uploadDisabled = false,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [searchFocused, setSearchFocused] = useState(false);
  const [dropResults, setDropResults] = useState<SearchResults | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [localHistory, setLocalHistory] = useState<string[]>(getLocalHistory);

  // Sync history from backend on mount
  const { data: serverHistory } = useQuery({
    queryKey: ['search-history'],
    queryFn: () => usersApi.getSearchHistory(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (serverHistory?.data) {
      const merged = Array.from(new Set([...serverHistory.data, ...getLocalHistory()])).slice(0, 10);
      setLocalHistory(merged);
      saveLocalHistory(merged);
    }
  }, [serverHistory?.data]);

  const addHistoryMutation = useMutation({
    mutationFn: (q: string) => usersApi.addSearchHistory(q),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['search-history'] }),
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => usersApi.clearSearchHistory(),
    onSuccess: () => {
      setLocalHistory([]);
      saveLocalHistory([]);
      qc.invalidateQueries({ queryKey: ['search-history'] });
    },
  });

  const removeHistoryItem = useMutation({
    mutationFn: (q: string) => usersApi.removeSearchHistoryItem(q),
    onSuccess: (_, q) => {
      const updated = localHistory.filter(h => h !== q);
      setLocalHistory(updated);
      saveLocalHistory(updated);
      qc.invalidateQueries({ queryKey: ['search-history'] });
    },
  });

  const addToHistory = useCallback((q: string) => {
    if (!q.trim() || q.trim().length < 2) return;
    const updated = [q.trim(), ...localHistory.filter(h => h !== q.trim())].slice(0, 10);
    setLocalHistory(updated);
    saveLocalHistory(updated);
    addHistoryMutation.mutate(q.trim());
  }, [localHistory, addHistoryMutation]);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) { setDropResults(null); setDropOpen(false); return; }
    try {
      const res = await searchApi.search(q);
      if (res.success && res.data) {
        setDropResults(res.data);
        setDropOpen(true);
        setHistoryOpen(false);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSearchChange = (q: string) => {
    onSearchChange(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) {
      setDropOpen(false);
      setDropResults(null);
      if (searchFocused) setHistoryOpen(true);
    } else {
      setHistoryOpen(false);
      debounceRef.current = setTimeout(() => fetchResults(q), 300);
    }
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setDropOpen(false); setHistoryOpen(false); }
    if (e.key === 'Enter' && searchQuery.trim()) {
      setDropOpen(false);
      setHistoryOpen(false);
      addToHistory(searchQuery.trim());
    }
  };

  const handleHistoryClick = (q: string) => {
    onSearchChange(q);
    setHistoryOpen(false);
    addToHistory(q);
    fetchResults(q);
  };

  const handleResultClick = (name: string) => {
    onSearchChange(name);
    setDropOpen(false);
    addToHistory(name);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropOpen(false);
        setHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-[#EEF2FF] dark:bg-[#1e1b4b]/50 text-[#4F46E5] rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const allResults = dropResults
    ? [...(dropResults.folders ?? []).map(f => ({ type: 'folder' as const, id: f.id, name: f.name })),
       ...(dropResults.files ?? []).map(f => ({ type: 'file' as const, id: f.id, name: f.name }))]
    : [];
  const showDrop = dropOpen && allResults.length > 0;
  const showHistory = historyOpen && !searchQuery && localHistory.length > 0;

  return (
    <header className="h-13 flex items-center gap-3 px-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] shrink-0" style={{ height: '52px' }}>
      <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors">
        <Menu className="w-4 h-4" strokeWidth={1.5} />
      </button>

      <span className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] shrink-0 hidden sm:block tracking-tight">{title}</span>

      {/* Search */}
      <div ref={searchWrapRef} className={`relative flex items-center gap-2 transition-all duration-300 ease-spring mx-auto ${searchFocused ? 'w-96' : 'w-60'} max-w-full`}>
        <div className="flex-1 flex items-center gap-2 bg-[#F8F8F8] dark:bg-[#141414] border border-transparent focus-within:border-[#E5E5E5] dark:focus-within:border-[#2A2A2A] rounded-lg px-3 transition-all duration-200">
          <Search className="w-3.5 h-3.5 text-[#AAAAAA] dark:text-[#444444] shrink-0" strokeWidth={1.5} />
          <input
            data-shortcut="search-input"
            placeholder={t('drive.searchPlaceholder')}
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              if (dropResults && searchQuery.length >= 2) setDropOpen(true);
              if (!searchQuery) setHistoryOpen(true);
            }}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={handleSearchKey}
            className="flex-1 h-8 bg-transparent text-xs text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => { handleSearchChange(''); }} className="text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] transition-colors text-xs">✕</button>
          )}
        </div>

        {/* Recent search history dropdown */}
        {showHistory && (
          <div className="absolute top-full mt-1.5 left-0 right-0 z-[200] bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden animate-modal-in">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#F0F0F0] dark:border-[#1E1E1E]">
              <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#555555] uppercase tracking-wider">Recent searches</span>
              <button
                onMouseDown={e => { e.preventDefault(); clearHistoryMutation.mutate(); }}
                className="text-[10px] text-[#AAAAAA] dark:text-[#555555] hover:text-[#EF4444] transition-colors"
              >
                Clear all
              </button>
            </div>
            {localHistory.slice(0, 5).map(q => (
              <div key={q} className="flex items-center gap-2 px-3 py-2 hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors group">
                <Clock className="w-3 h-3 text-[#AAAAAA] dark:text-[#555555] shrink-0" strokeWidth={1.5} />
                <button
                  onMouseDown={e => { e.preventDefault(); handleHistoryClick(q); }}
                  className="flex-1 text-xs text-[#0A0A0A] dark:text-[#F5F5F5] text-left truncate"
                >
                  {q}
                </button>
                <button
                  onMouseDown={e => { e.preventDefault(); removeHistoryItem.mutate(q); }}
                  className="opacity-0 group-hover:opacity-100 text-[#AAAAAA] hover:text-[#EF4444] transition-all shrink-0"
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Instant search dropdown */}
        {showDrop && (
          <div className="absolute top-full mt-1.5 left-0 right-0 z-[200] bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden animate-modal-in">
            {allResults.slice(0, 8).map(item => (
              <button
                key={`${item.type}-${item.id}`}
                onMouseDown={e => { e.preventDefault(); handleResultClick(item.name); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors text-left"
              >
                {item.type === 'folder'
                  ? <FolderIcon className="w-3.5 h-3.5 shrink-0 text-[#F59E0B]" strokeWidth={1.5} />
                  : <FileText className="w-3.5 h-3.5 shrink-0 text-[#4F46E5]" strokeWidth={1.5} />
                }
                <span className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{highlight(item.name, searchQuery)}</span>
                <span className="ml-auto text-[10px] text-[#AAAAAA] dark:text-[#444444] shrink-0">{item.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hidden sm:flex items-center gap-1 px-2.5 h-8 text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] rounded-lg transition-all gap-1.5">
              {sortOrder === 'asc' ? <SortAsc className="w-3.5 h-3.5" strokeWidth={1.5} /> : <SortDesc className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {sortLabels[sortField]}
              <ChevronDown className="w-3 h-3 opacity-50" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.entries(sortLabels) as [SortField, string][]).map(([f, label]) => (
              <DropdownMenuItem key={f} onClick={() => onSortChange(f)} className={sortField === f ? 'text-[#4F46E5] dark:text-[#6366f1]' : ''}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View toggle */}
        <div className="flex items-center border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg overflow-hidden">
          <button onClick={() => onViewModeChange('grid')} className={`p-2 transition-all ${viewMode === 'grid' ? 'bg-[#F0F0F0] dark:bg-[#1E1E1E] text-[#0A0A0A] dark:text-[#F5F5F5]' : 'text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B]'}`}>
            <Grid className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button onClick={() => onViewModeChange('list')} className={`p-2 transition-all border-l border-[#E5E5E5] dark:border-[#2A2A2A] ${viewMode === 'list' ? 'bg-[#F0F0F0] dark:bg-[#1E1E1E] text-[#0A0A0A] dark:text-[#F5F5F5]' : 'text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B]'}`}>
            <List className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Activity feed */}
        <ActivityFeed />

        {/* Notification bell */}
        <NotificationBell />

        {/* Theme */}
        <button onClick={toggleTheme} className="p-2 rounded-lg text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] dark:hover:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-all">
          {theme === 'dark' ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />}
        </button>

        {/* Language */}
        <LanguageSwitcher />

        {/* Upload */}
        <button onClick={onUploadClick} disabled={uploadDisabled} className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all hover:scale-[1.02]">
          <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">{t('drive.uploadFile')}</span>
        </button>
      </div>
    </header>
  );
}
