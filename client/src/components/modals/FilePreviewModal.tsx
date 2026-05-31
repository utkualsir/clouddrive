import { useEffect, useRef, useState } from 'react';
import { Download, Eye, Heart, MessageSquare, Trash2, X } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';
import AudioPlayer from '@/components/AudioPlayer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { File, FileComment } from '@/types';
import { FileTypeTag } from '@/components/FileIcon';
import { formatFileSize, formatDate, getFileCategory } from '@/lib/utils';
import { filesApi } from '@/api/files';
import { commentsApi } from '@/api/comments';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';

interface FilePreviewModalProps {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onDownload: (file: File) => void;
}

type Tab = 'preview' | 'comments';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function FilePreviewModal({ file, open, onClose, onDownload }: FilePreviewModalProps) {
  const { user } = useAuth();
  const { lastEvent } = useWebSocket();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('preview');
  const [commentText, setCommentText] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(!!file?.isLiked);
  const [likeCount, setLikeCount] = useState(file?.likeCount ?? 0);
  const [viewCount, setViewCount] = useState(file?.viewCount ?? 0);

  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['comments', file?.id],
    queryFn: () => commentsApi.getAll(file!.id),
    enabled: !!file?.id && open,
  });

  const comments: FileComment[] = commentsData?.data ?? [];

  const postMutation = useMutation({
    mutationFn: (content: string) => commentsApi.post(file!.id, content),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', file?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(file!.id, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', file?.id] }),
  });

  useEffect(() => {
    if (lastEvent?.type === 'file_commented' && lastEvent.fileId === file?.id) {
      refetchComments();
    }
  }, [lastEvent, file?.id, refetchComments]);

  useEffect(() => {
    if (tab === 'comments') {
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [comments.length, tab]);

  // Reset tab + sync like/view state when a new file opens
  useEffect(() => {
    if (open && file) {
      setTab('preview');
      setLiked(!!file.isLiked);
      setLikeCount(file.likeCount ?? 0);
      setViewCount(v => v === (file.viewCount ?? 0) ? v + 1 : (file.viewCount ?? 0) + 1);
      filesApi.incrementView(file.id);
    }
  }, [file?.id, open]);

  const handleLike = async () => {
    if (!file) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : Math.max(0, c - 1));
    try {
      const res = await filesApi.toggleLike(file.id);
      if (res.data) { setLiked(res.data.liked); setLikeCount(res.data.likeCount); }
    } catch {
      setLiked(!newLiked);
      setLikeCount(c => newLiked ? Math.max(0, c - 1) : c + 1);
    }
  };

  if (!file) return null;

  const category = getFileCategory(file.mimeType);
  const downloadUrl = filesApi.getDownloadUrl(file.id);
  const token = localStorage.getItem('token');
  const previewUrl = `${downloadUrl}${token ? `?token=${token}` : ''}`;
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

  const renderPreview = () => {
    switch (category) {
      case 'image':
        return (
          <img
            src={`${apiBase}/api/files/${file.id}/download${token ? `?token=${token}` : ''}`}
            alt={file.name}
            className="max-h-[55vh] max-w-full object-contain mx-auto block"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        );
      case 'pdf':
        return (
          <iframe
            src={previewUrl}
            className="w-full h-[55vh] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg"
            title={file.name}
          />
        );
      case 'video':
        return (
          <VideoPlayer
            src={`${apiBase}/api/files/${file.id}/download${token ? `?token=${token}` : ''}`}
            mimeType={file.mimeType}
            onDownload={() => onDownload(file)}
          />
        );
      case 'audio':
        return (
          <AudioPlayer
            src={`${apiBase}/api/files/${file.id}/download${token ? `?token=${token}` : ''}`}
            mimeType={file.mimeType}
            fileName={file.name}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="w-16 h-16 rounded-xl bg-[#F8F8F8] dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-center">
              <FileTypeTag mimeType={file.mimeType} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">Preview not available</p>
              <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mt-1">Download the file to view its contents</p>
            </div>
            <button
              onClick={() => onDownload(file)}
              className="flex items-center gap-2 h-8 px-4 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
              Download
            </button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0">
          <FileTypeTag mimeType={file.mimeType} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{file.name}</p>
            <div className="flex items-center gap-3 text-[11px] text-[#AAAAAA] dark:text-[#444444] mt-0.5">
              <span>{formatFileSize(file.size)} · {formatDate(file.createdAt)}</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" strokeWidth={1.5} />{viewCount}</span>
              <span className="flex items-center gap-1"><Download className="w-3 h-3" strokeWidth={1.5} />{file.downloadCount}</span>
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 transition-colors hover:text-red-400 ${liked ? 'text-red-400' : ''}`}
              >
                <Heart className={`w-3 h-3 ${liked ? 'fill-red-400 stroke-red-400' : ''}`} strokeWidth={1.5} />
                {likeCount}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onDownload(file)}
              className="p-1.5 rounded-md text-[#AAAAAA] dark:text-[#444444] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors"
            >
              <Download className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#AAAAAA] dark:text-[#444444] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0">
          {([
            { id: 'preview' as Tab, label: 'Preview' },
            { id: 'comments' as Tab, label: `Comments (${comments.length})` },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[#4F46E5] text-[#4F46E5] dark:text-[#6366f1]'
                  : 'border-transparent text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'preview' ? (
          <div className="p-5 bg-[#F8F8F8] dark:bg-[#0F0F0F] flex-1 flex items-center justify-center overflow-auto">
            {renderPreview()}
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <MessageSquare className="w-8 h-8 text-[#E5E5E5] dark:text-[#2A2A2A]" strokeWidth={1} />
                  <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">No comments yet. Be the first!</p>
                </div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex gap-2.5 group">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 mt-0.5"
                      style={{ backgroundColor: c.user.avatarColor }}
                    >
                      {c.user.displayName[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">{c.user.displayName}</span>
                        <span className="text-[10px] text-[#AAAAAA] dark:text-[#444444]">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] mt-0.5 leading-relaxed">{c.content}</p>
                    </div>
                    {(user?.id === c.user.id || user?.role === 'ADMIN') && (
                      <button
                        onClick={() => deleteMutation.mutate(c.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 rounded text-[#AAAAAA] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment input */}
            <div className="shrink-0 px-5 py-3 border-t border-[#E5E5E5] dark:border-[#2A2A2A]">
              <div className="flex gap-2 items-end">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (commentText.trim()) postMutation.mutate(commentText);
                    }
                  }}
                  placeholder="Add a comment… (Enter to post, Shift+Enter for newline)"
                  rows={2}
                  maxLength={500}
                  className="flex-1 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-xs text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] resize-none transition-colors"
                />
                <button
                  onClick={() => { if (commentText.trim()) postMutation.mutate(commentText); }}
                  disabled={!commentText.trim() || postMutation.isPending}
                  className="px-3 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 text-white text-xs font-medium transition-colors shrink-0"
                >
                  Post
                </button>
              </div>
              <p className="text-[10px] text-[#AAAAAA] dark:text-[#444444] mt-1 text-right">{commentText.length}/500</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
