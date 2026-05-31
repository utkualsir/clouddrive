import { useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Heart, Edit2, Trash2, Pin, Lock, CheckCircle2,
  Eye, MessageSquare, ChevronLeft, ChevronRight, Loader2, Send,
} from 'lucide-react';
import { forumApi } from '@/api/forum';
import { useAuth } from '@/contexts/AuthContext';
import { ForumPost } from '@/types';
import { renderMarkdown, timeAgo, TagPill, ThreadBadges, Avatar } from './forumUtils';
import toast from 'react-hot-toast';

function PostCard({
  post,
  isOp,
  isThreadAuthor,
  currentUserId,
  isAdmin,
  onLike,
  onEdit,
  onDelete,
  onMarkAnswer,
}: {
  post: ForumPost;
  isOp?: boolean;
  isThreadAuthor: boolean;
  currentUserId?: string;
  isAdmin: boolean;
  onLike: (id: string) => void;
  onEdit: (post: ForumPost) => void;
  onDelete: (id: string) => void;
  onMarkAnswer: (id: string) => void;
}) {
  const canEdit = currentUserId === post.authorId || isAdmin;
  const canAnswer = isThreadAuthor && !isOp && currentUserId !== post.authorId;

  return (
    <div
      className={`bg-white dark:bg-[#141414] border rounded-xl overflow-hidden transition-all ${
        post.isAnswer
          ? 'border-green-400 dark:border-green-600 ring-1 ring-green-400/30'
          : 'border-[#E5E5E5] dark:border-[#2A2A2A]'
      }`}
    >
      {post.isAnswer && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" strokeWidth={2} />
          <span className="text-xs font-semibold text-green-700 dark:text-green-300">Accepted Answer</span>
        </div>
      )}
      <div className="flex gap-4 p-5">
        {/* Author card */}
        <div className="flex flex-col items-center gap-2 w-24 shrink-0 hidden sm:flex">
          <Link to={`/profile/${post.author.id}`}>
            <Avatar user={post.author} size={44} />
          </Link>
          <Link to={`/profile/${post.author.id}`} className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] text-center hover:text-[#4F46E5] transition-colors">
            {post.author.displayName}
          </Link>
          <p className="text-[10px] text-[#9CA3AF] dark:text-[#555555] text-center">@{post.author.username}</p>
          <p className="text-[10px] text-[#9CA3AF] dark:text-[#555555] text-center">
            Joined {new Date(post.author.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile author row */}
          <div className="flex items-center gap-2 mb-3 sm:hidden">
            <Avatar user={post.author} size={28} />
            <span className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">{post.author.displayName}</span>
            <span className="text-xs text-[#9CA3AF] dark:text-[#555555]">· {timeAgo(post.createdAt)}</span>
          </div>

          <div className="hidden sm:block text-xs text-[#9CA3AF] dark:text-[#555555] mb-2">{timeAgo(post.createdAt)}</div>

          {/* Markdown content */}
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-[#374151] dark:text-[#CCCCCC] [&_pre]:bg-[#F3F4F6] dark:[&_pre]:bg-[#1E1E1E] [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-[#EF4444] [&_code]:bg-[#FEF2F2] dark:[&_code]:bg-[#2A1515] dark:[&_code]:text-[#FC8181] [&_code]:px-1 [&_code]:rounded [&_pre_code]:bg-transparent dark:[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:px-0 [&_a]:text-[#4F46E5] [&_blockquote]:border-l-4 [&_blockquote]:border-[#E5E7EB] dark:[&_blockquote]:border-[#2A2A2A] [&_blockquote]:pl-3 [&_blockquote]:text-[#6B7280]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />

          {/* Edited indicator */}
          {post.updatedAt !== post.createdAt && (
            <p className="text-[11px] text-[#9CA3AF] dark:text-[#555555] mt-2 italic">edited</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#F3F4F6] dark:border-[#1E1E1E]">
            {currentUserId ? (
              <button
                onClick={() => onLike(post.id)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
                  post.isLiked
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                    : 'text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${post.isLiked ? 'fill-current' : ''}`} strokeWidth={post.isLiked ? 0 : 1.5} />
                {post.likeCount > 0 && <span>{post.likeCount}</span>}
                Like
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF] dark:text-[#555555]">
                <Heart className="w-3.5 h-3.5" strokeWidth={1.5} />{post.likeCount > 0 ? post.likeCount : ''} Like
              </span>
            )}

            {canAnswer && (
              <button
                onClick={() => onMarkAnswer(post.id)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
                  post.isAnswer
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : 'text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                {post.isAnswer ? 'Unmark Answer' : 'Mark as Answer'}
              </button>
            )}

            <div className="flex-1" />

            {canEdit && (
              <>
                <button
                  onClick={() => onEdit(post)}
                  className="flex items-center gap-1 text-xs text-[#9CA3AF] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888] transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Edit
                </button>
                {!isOp && (
                  <button
                    onClick={() => onDelete(post.id)}
                    className="flex items-center gap-1 text-xs text-[#9CA3AF] dark:text-[#555555] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForumThreadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const [page, setPage] = useState(1);
  const [replyContent, setReplyContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [editContent, setEditContent] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  // Thread query
  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['forum-thread', id],
    queryFn: () => forumApi.getThread(id!),
    enabled: !!id,
  });
  const thread = threadData?.data;

  // Posts query
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['forum-posts', id, page],
    queryFn: () => forumApi.getPosts(id!, page),
    enabled: !!id,
  });
  const posts: ForumPost[] = postsData?.data?.posts ?? [];
  const totalPages = postsData?.data?.pages ?? 1;

  const invalidateThread = () => qc.invalidateQueries({ queryKey: ['forum-thread', id] });
  const invalidatePosts = () => qc.invalidateQueries({ queryKey: ['forum-posts', id] });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: (content: string) => forumApi.createPost(id!, content),
    onSuccess: () => {
      setReplyContent('');
      setPreviewMode(false);
      invalidateThread();
      invalidatePosts();
      toast.success('Reply posted!');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'Failed to post reply');
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: ({ postId, content }: { postId: string; content: string }) => forumApi.updatePost(postId, content),
    onSuccess: () => { setEditingPost(null); invalidatePosts(); toast.success('Post updated'); },
    onError: () => toast.error('Failed to update post'),
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => forumApi.deletePost(postId),
    onSuccess: () => { invalidatePosts(); toast.success('Post deleted'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'Failed to delete post');
    },
  });

  // Delete thread mutation
  const deleteThreadMutation = useMutation({
    mutationFn: () => forumApi.deleteThread(id!),
    onSuccess: () => {
      toast.success('Thread deleted');
      if (thread) navigate(`/forum/category/${thread.categoryId}`);
      else navigate('/forum');
    },
    onError: () => toast.error('Failed to delete thread'),
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: (postId: string) => forumApi.likePost(postId),
    onSuccess: (data, postId) => {
      qc.setQueryData(['forum-posts', id, page], (old: typeof postsData) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            posts: old.data.posts.map(p =>
              p.id === postId
                ? { ...p, isLiked: data.data!.liked, likeCount: data.data!.likeCount }
                : p,
            ),
          },
        };
      });
    },
    onError: () => toast.error('Failed to toggle like'),
  });

  // Pin mutation
  const pinMutation = useMutation({
    mutationFn: () => forumApi.pinThread(id!),
    onSuccess: () => { invalidateThread(); toast.success('Pin toggled'); },
  });

  // Lock mutation
  const lockMutation = useMutation({
    mutationFn: () => forumApi.lockThread(id!),
    onSuccess: () => { invalidateThread(); toast.success('Lock toggled'); },
  });

  // Solve mutation
  const solveMutation = useMutation({
    mutationFn: () => forumApi.solveThread(id!),
    onSuccess: () => { invalidateThread(); toast.success('Solved status toggled'); },
  });

  // Answer mutation
  const answerMutation = useMutation({
    mutationFn: (postId: string) => forumApi.markAnswer(postId),
    onSuccess: () => { invalidateThread(); invalidatePosts(); toast.success('Answer marked!'); },
    onError: () => toast.error('Failed to mark answer'),
  });

  if (threadLoading) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] flex flex-col items-center justify-center gap-3">
        <p className="text-[#6B7280] dark:text-[#555555]">Thread not found</p>
        <button onClick={() => navigate('/forum')} className="text-sm text-[#4F46E5] hover:underline">
          Back to Forum
        </button>
      </div>
    );
  }

  const isThreadAuthor = user?.id === thread.authorId;
  const canModifyThread = isThreadAuthor || isAdmin;

  // Build OP as a pseudo-ForumPost for rendering
  const opPost: ForumPost = {
    id: `op-${thread.id}`,
    content: thread.content,
    threadId: thread.id,
    authorId: thread.authorId,
    author: thread.author,
    isAnswer: false,
    likeCount: 0,
    isLiked: false,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Top bar */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-2">
          <button
            onClick={() => navigate(`/forum/category/${thread.categoryId}`)}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <nav className="flex items-center gap-1 text-sm text-[#6B7280] dark:text-[#555555] min-w-0">
            <Link to="/forum" className="hover:text-[#4F46E5] transition-colors shrink-0">Forum</Link>
            <span className="mx-1 shrink-0">›</span>
            <Link to={`/forum/category/${thread.categoryId}`} className="hover:text-[#4F46E5] transition-colors truncate max-w-[120px]">
              {thread.category.name}
            </Link>
            <span className="mx-1 shrink-0">›</span>
            <span className="text-[#0A0A0A] dark:text-[#F5F5F5] font-medium truncate">{thread.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Thread header */}
        <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                  style={{ backgroundColor: thread.category.color + '20', color: thread.category.color }}
                >
                  {thread.category.name}
                </span>
                <ThreadBadges isPinned={thread.isPinned} isLocked={thread.isLocked} isSolved={thread.isSolved} />
              </div>
              <h1 className="text-xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] leading-snug">{thread.title}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#9CA3AF] dark:text-[#555555]">
                <span>By <Link to={`/profile/${thread.author.id}`} className="text-[#6B7280] dark:text-[#888888] hover:text-[#4F46E5] font-medium">{thread.author.displayName}</Link></span>
                <span>{timeAgo(thread.createdAt)}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" strokeWidth={1.5} />{thread.views} views</span>
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" strokeWidth={1.5} />{thread.postCount} replies</span>
              </div>
              {thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {thread.tags.map(tag => <TagPill key={tag} tag={tag} />)}
                </div>
              )}
            </div>

            {/* Thread actions */}
            {canModifyThread && (
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {isThreadAuthor && (
                  <>
                    <Link
                      to={`/forum/new?edit=${thread.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888] transition-colors"
                    >
                      <Edit2 className="w-3 h-3" strokeWidth={1.5} /> Edit
                    </Link>
                    <button
                      onClick={() => solveMutation.mutate()}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        thread.isSolved
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888]'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" strokeWidth={1.5} /> {thread.isSolved ? 'Solved' : 'Mark Solved'}
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this thread and all its replies?')) deleteThreadMutation.mutate(); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#9CA3AF] dark:text-[#555555] hover:text-red-500 hover:border-red-300 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1.5} /> Delete
                    </button>
                  </>
                )}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => pinMutation.mutate()}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        thread.isPinned
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888]'
                      }`}
                    >
                      <Pin className="w-3 h-3" strokeWidth={1.5} /> {thread.isPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      onClick={() => lockMutation.mutate()}
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        thread.isLocked
                          ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                          : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888]'
                      }`}
                    >
                      <Lock className="w-3 h-3" strokeWidth={1.5} /> {thread.isLocked ? 'Unlock' : 'Lock'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* OP post */}
        <PostCard
          post={opPost}
          isOp
          isThreadAuthor={isThreadAuthor}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          onLike={() => {}}
          onEdit={() => {
            navigate(`/forum/new?edit=${thread.id}`);
          }}
          onDelete={() => {}}
          onMarkAnswer={() => {}}
        />

        {/* Replies header */}
        {(thread.postCount > 0 || postsLoading) && (
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#6B7280] dark:text-[#555555] uppercase tracking-wider">
              {thread.postCount} {thread.postCount === 1 ? 'Reply' : 'Replies'}
            </h2>
          </div>
        )}

        {/* Replies */}
        {postsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isThreadAuthor={isThreadAuthor}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                onLike={pid => likeMutation.mutate(pid)}
                onEdit={p => { setEditingPost(p); setEditContent(p.content); }}
                onDelete={pid => { if (confirm('Delete this reply?')) deletePostMutation.mutate(pid); }}
                onMarkAnswer={pid => answerMutation.mutate(pid)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <span className="text-sm text-[#6B7280] dark:text-[#555555]">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Locked banner */}
        {thread.isLocked && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#F3F4F6] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2A2A2A]">
            <Lock className="w-4 h-4 text-[#9CA3AF] dark:text-[#555555]" strokeWidth={1.5} />
            <p className="text-sm text-[#6B7280] dark:text-[#888888]">This thread is locked. No new replies can be posted.</p>
          </div>
        )}

        {/* Reply form */}
        {!thread.isLocked && (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5">
            {user ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Post a Reply</h3>
                  <button
                    onClick={() => setPreviewMode(v => !v)}
                    className="text-xs text-[#6B7280] dark:text-[#555555] hover:text-[#4F46E5] transition-colors"
                  >
                    {previewMode ? '← Edit' : 'Preview →'}
                  </button>
                </div>
                {previewMode ? (
                  <div
                    className="min-h-[120px] p-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] prose prose-sm dark:prose-invert max-w-none text-[#374151] dark:text-[#CCCCCC]"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(replyContent || '*Nothing to preview…*') }}
                  />
                ) : (
                  <textarea
                    ref={replyRef}
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    placeholder="Write your reply… Markdown is supported"
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] dark:placeholder-[#444444] resize-none focus:outline-none focus:border-[#4F46E5] transition-colors"
                  />
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs ${replyContent.length > 4800 ? 'text-red-500' : 'text-[#9CA3AF] dark:text-[#555555]'}`}>
                    {replyContent.length}/5000
                  </span>
                  <button
                    onClick={() => replyMutation.mutate(replyContent)}
                    disabled={replyMutation.isPending || replyContent.trim().length < 5}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {replyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Post Reply
                  </button>
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-[#6B7280] dark:text-[#888888]">
                <Link to="/login" className="text-[#4F46E5] hover:underline font-medium">Sign in</Link> to reply
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edit post modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4">
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Edit Reply</h3>
              <button onClick={() => setEditingPost(null)} className="text-[#9CA3AF] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888]">✕</button>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] resize-none focus:outline-none focus:border-[#4F46E5] transition-colors"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingPost(null)} className="px-4 py-2 text-sm rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => editMutation.mutate({ postId: editingPost.id, content: editContent })}
                disabled={editMutation.isPending || editContent.trim().length < 5}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {editMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
