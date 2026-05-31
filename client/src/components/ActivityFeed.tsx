import { useEffect, useRef, useState } from 'react';
import { Bell, Upload, Download, Folder, Share2, LogIn, Trash2, Star, Pencil } from 'lucide-react';
import { Activity, WsEvent } from '@/types';
import { filesApi } from '@/api/files';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/contexts/WebSocketContext';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function activityIcon(action: string) {
  if (action.includes('upload') || action === 'file_uploaded') return <Upload className="w-3.5 h-3.5 text-[#4F46E5]" strokeWidth={1.5} />;
  if (action.includes('download') || action === 'file_downloaded') return <Download className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={1.5} />;
  if (action.includes('folder') || action === 'folder_created') return <Folder className="w-3.5 h-3.5 text-[#F59E0B]" strokeWidth={1.5} />;
  if (action.includes('share')) return <Share2 className="w-3.5 h-3.5 text-[#8B5CF6]" strokeWidth={1.5} />;
  if (action.includes('login') || action === 'user_online') return <LogIn className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.5} />;
  if (action.includes('trash') || action === 'file_deleted') return <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" strokeWidth={1.5} />;
  if (action.includes('star')) return <Star className="w-3.5 h-3.5 text-[#F59E0B]" strokeWidth={1.5} />;
  if (action.includes('edit')) return <Pencil className="w-3.5 h-3.5 text-[#3B82F6]" strokeWidth={1.5} />;
  return <Bell className="w-3.5 h-3.5 text-[#AAAAAA]" strokeWidth={1.5} />;
}

function wsEventToText(ev: WsEvent): string {
  const who = ev.displayName ?? 'Someone';
  if (ev.type === 'file_uploaded') return `${who} uploaded ${ev.fileName ?? 'a file'}`;
  if (ev.type === 'file_deleted') return `${who} deleted ${ev.fileName ?? 'a file'}`;
  if (ev.type === 'file_downloaded') return `${who} downloaded ${ev.fileName ?? 'a file'}`;
  if (ev.type === 'folder_created') return `${who} created folder ${ev.folderName ?? ''}`;
  if (ev.type === 'user_online') return `${who} came online`;
  return ev.type.replace(/_/g, ' ');
}

interface LiveNotification {
  id: string;
  event: WsEvent;
  read: boolean;
}

export default function ActivityFeed() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { lastEvent } = useWebSocket();
  const [liveNotifs, setLiveNotifs] = useState<LiveNotification[]>([]);

  const { data } = useQuery({
    queryKey: ['activity'],
    queryFn: () => filesApi.getActivity(),
    refetchInterval: 30000,
  });

  const activities: Activity[] = data?.data ?? [];

  // Accumulate live WS events as unread notifications
  useEffect(() => {
    if (!lastEvent) return;
    setLiveNotifs(prev => [
      { id: `${Date.now()}-${Math.random()}`, event: lastEvent, read: false },
      ...prev,
    ].slice(0, 50));
  }, [lastEvent]);

  const dbUnread = activities.filter(a => !a.isRead).length;
  const liveUnread = liveNotifs.filter(n => !n.read).length;
  const totalUnread = dbUnread + liveUnread;

  const markReadMutation = useMutation({
    mutationFn: () => filesApi.markActivityRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity'] }),
  });

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open) {
      if (dbUnread > 0) markReadMutation.mutate();
      setLiveNotifs(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const markAllRead = () => {
    if (dbUnread > 0) markReadMutation.mutate();
    setLiveNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] dark:hover:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-all duration-150"
      >
        <Bell className="w-4 h-4" strokeWidth={1.5} />
        {totalUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-0.5 animate-pulse">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-50 animate-modal-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
            <span className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Activity</span>
            <button
              onClick={markAllRead}
              className="text-[10px] text-[#4F46E5] hover:underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {liveNotifs.length === 0 && activities.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#AAAAAA] dark:text-[#444444]">
                No activity yet
              </div>
            ) : (
              <>
                {/* Live WS notifications at top */}
                {liveNotifs.map(({ id, event, read }) => (
                  <div
                    key={id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E] last:border-0 ${!read ? 'bg-[#F8F8FF] dark:bg-[#1a1a2e]/30' : ''}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#F0F0F0] dark:bg-[#252525] flex items-center justify-center shrink-0 mt-0.5">
                      {activityIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] leading-snug">{wsEventToText(event)}</p>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444] mt-0.5">
                        {event.timestamp ? timeAgo(event.timestamp) : 'just now'}
                      </p>
                    </div>
                  </div>
                ))}
                {/* DB activities */}
                {activities.map(a => (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E] last:border-0 ${!a.isRead ? 'bg-[#F8F8FF] dark:bg-[#1a1a2e]/30' : ''}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#F0F0F0] dark:bg-[#252525] flex items-center justify-center shrink-0 mt-0.5">
                      {activityIcon(a.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5]">
                        <span className="capitalize">{a.action}</span>{' '}
                        <span className="font-medium truncate">{a.target}</span>
                      </p>
                      <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444] mt-0.5">{timeAgo(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
