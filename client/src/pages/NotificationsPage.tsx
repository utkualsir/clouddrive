import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, Trash2, ArrowLeft, X } from 'lucide-react';
import { notificationsApi } from '@/api/notifications';
import { AppNotification, NotificationType } from '@/types';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type FilterTab = 'all' | 'unread' | 'social' | 'files' | 'system';

const SOCIAL_TYPES: NotificationType[] = ['FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'FOLLOW'];
const FILE_TYPES: NotificationType[] = ['FILE_SHARED', 'FOLDER_SHARED', 'FILE_COMMENT', 'COMMENT_REPLY', 'COMMENT_MENTION'];
const SYSTEM_TYPES: NotificationType[] = ['STORAGE_WARNING', 'SYSTEM'];

const TYPE_ICON: Record<NotificationType, string> = {
  FRIEND_REQUEST:   '👥',
  FRIEND_ACCEPTED:  '🤝',
  FOLLOW:           '👤',
  FILE_SHARED:      '📤',
  FOLDER_SHARED:    '📂',
  FILE_COMMENT:     '💬',
  COMMENT_REPLY:    '↩️',
  COMMENT_MENTION:  '@️',
  STORAGE_WARNING:  '⚠️',
  FORUM_REPLY:      '💬',
  FORUM_ANSWER:     '✅',
  NEW_MESSAGE:      '✉️',
  SYSTEM:           '🔔',
};

function Avatar({ notif }: { notif: AppNotification }) {
  const from = notif.from;
  if (!from) {
    return (
      <div className="w-9 h-9 rounded-full bg-[#4F46E5] flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-white" />
      </div>
    );
  }
  const src = from.avatarUrl ? `${apiBase}${from.avatarUrl}` : null;
  return src ? (
    <img src={src} alt={from.displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
  ) : (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
      style={{ backgroundColor: from.avatarColor }}
    >
      {from.displayName[0]?.toUpperCase()}
    </div>
  );
}

function NotifItem({ notif, onMarkRead, onDelete, onClick }: {
  notif: AppNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notif: AppNotification) => void;
}) {
  const timeAgo = formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true });
  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
        notif.read
          ? 'hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E]'
          : 'bg-indigo-50/60 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
      }`}
      onClick={() => onClick(notif)}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
      )}

      {/* Avatar with type badge */}
      <div className="relative shrink-0">
        <Avatar notif={notif} />
        <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
          {TYPE_ICON[notif.type as NotificationType] ?? '🔔'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${notif.read ? 'text-[#374151] dark:text-[#888888]' : 'text-[#0A0A0A] dark:text-[#F5F5F5] font-medium'}`}>
          {notif.message}
        </p>
        <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-0.5">{timeAgo}</p>
      </div>

      {/* Action buttons (visible on hover) */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {!notif.read && (
          <button
            onClick={() => onMarkRead(notif.id)}
            title="Mark as read"
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#1e1b4b]/20 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(notif.id)}
          title="Delete"
          className="p-1.5 rounded-lg text-[#6B7280] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { unreadBump } = useWebSocket();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const queryParams = {
    page,
    limit: LIMIT,
    ...(filterTab === 'unread' ? { unread: true } : {}),
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', filterTab, page],
    queryFn: () => notificationsApi.getAll(queryParams),
  });

  useEffect(() => {
    if (unreadBump > 0) refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadBump]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
    },
  });

  const deleteAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.deleteAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const allNotifs: AppNotification[] = data?.data?.notifications ?? [];

  const filtered = (() => {
    if (filterTab === 'social') return allNotifs.filter(n => SOCIAL_TYPES.includes(n.type as NotificationType));
    if (filterTab === 'files')  return allNotifs.filter(n => FILE_TYPES.includes(n.type as NotificationType));
    if (filterTab === 'system') return allNotifs.filter(n => SYSTEM_TYPES.includes(n.type as NotificationType));
    return allNotifs;
  })();

  const pages = data?.data?.pages ?? 1;
  const unreadCount = allNotifs.filter(n => !n.read).length;

  const handleClick = (notif: AppNotification) => {
    if (!notif.read) markReadMutation.mutate(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all',    label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'social', label: 'Social' },
    { id: 'files',  label: 'Files' },
    { id: 'system', label: 'System' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors text-[#6B6B6B] dark:text-[#888888]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-[#6B7280] dark:text-[#555555]">{unreadCount} unread</p>
            )}
          </div>
          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-[#4F46E5] hover:border-[#4F46E5] transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={() => deleteAllReadMutation.mutate()}
              disabled={deleteAllReadMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear read
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 bg-[#F0F0F0] dark:bg-[#1E1E1E] p-1 rounded-xl overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setFilterTab(id); setPage(1); }}
              className={`shrink-0 px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap font-medium ${
                filterTab === id
                  ? 'bg-white dark:bg-[#141414] text-[#0A0A0A] dark:text-[#F5F5F5] shadow-sm'
                  : 'text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white dark:bg-[#111111] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Bell className="w-10 h-10 text-[#CCCCCC] dark:text-[#333333]" strokeWidth={1.5} />
              <p className="text-sm font-medium text-[#6B7280] dark:text-[#555555]">You're all caught up!</p>
              <p className="text-xs text-[#9CA3AF] dark:text-[#444444]">No notifications to show.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6] dark:divide-[#1E1E1E] px-1 py-1">
              {filtered.map(notif => (
                <NotifItem
                  key={notif.id}
                  notif={notif}
                  onMarkRead={id => markReadMutation.mutate(id)}
                  onDelete={id => deleteMutation.mutate(id)}
                  onClick={handleClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-[#6B7280] dark:text-[#555555]">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="px-4 py-2 text-sm rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
