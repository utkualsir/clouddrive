import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, MessageSquare, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { forumApi } from '@/api/forum';
import { useAuth } from '@/contexts/AuthContext';
import { ForumThread } from '@/types';
import { CategoryIcon, timeAgo, TagPill, ThreadBadges, Avatar } from './forumUtils';

type Sort = 'latest' | 'popular' | 'unanswered';

export default function ForumCategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sort, setSort] = useState<Sort>('latest');
  const [page, setPage] = useState(1);

  const { data: catData } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: () => forumApi.getCategories(),
  });
  const category = catData?.data?.find(c => c.id === id);

  const { data: threadsData, isLoading } = useQuery({
    queryKey: ['forum-threads', id, sort, page],
    queryFn: () => forumApi.getThreads({ categoryId: id, sort, page }),
    enabled: !!id,
  });
  const threads: ForumThread[] = threadsData?.data?.threads ?? [];
  const totalPages = threadsData?.data?.pages ?? 1;

  const sortTabs: { key: Sort; label: string }[] = [
    { key: 'latest', label: 'Latest' },
    { key: 'popular', label: 'Popular' },
    { key: 'unanswered', label: 'Unanswered' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Top bar */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/forum')}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <nav className="flex items-center gap-1 text-sm text-[#6B7280] dark:text-[#555555]">
            <Link to="/forum" className="hover:text-[#4F46E5] transition-colors">Forum</Link>
            <span className="mx-1">›</span>
            <span className="text-[#0A0A0A] dark:text-[#F5F5F5] font-medium">{category?.name ?? '…'}</span>
          </nav>
          <div className="flex-1" />
          {user && (
            <Link
              to={`/forum/new${id ? `?cat=${id}` : ''}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              New Thread
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Category header */}
        {category && (
          <div className="flex items-center gap-4">
            <CategoryIcon icon={category.icon} color={category.color} size={22} />
            <div>
              <h1 className="text-xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{category.name}</h1>
              <p className="text-sm text-[#6B7280] dark:text-[#888888]">{category.description}</p>
            </div>
          </div>
        )}

        {/* Sort tabs */}
        <div className="flex items-center gap-1 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          {sortTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setSort(tab.key); setPage(1); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                sort === tab.key
                  ? 'border-[#4F46E5] text-[#4F46E5]'
                  : 'border-transparent text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Thread list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-12 text-center">
            <MessageSquare className="w-10 h-10 text-[#D1D5DB] dark:text-[#333333] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#374151] dark:text-[#888888]">No threads yet</p>
            <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-1">Be the first to start a discussion</p>
            {user && (
              <Link
                to={`/forum/new${id ? `?cat=${id}` : ''}`}
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New Thread
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl divide-y divide-[#F3F4F6] dark:divide-[#1E1E1E]">
            {threads.map(thread => (
              <div key={thread.id} className="flex items-start gap-3 p-4 hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A] transition-colors">
                <Avatar user={thread.author} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <ThreadBadges isPinned={thread.isPinned} isLocked={thread.isLocked} isSolved={thread.isSolved} />
                  </div>
                  <Link
                    to={`/forum/thread/${thread.id}`}
                    className="block text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] hover:text-[#4F46E5] transition-colors"
                  >
                    {thread.title}
                  </Link>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-0.5 line-clamp-1">
                    {thread.content.slice(0, 120)}
                  </p>
                  {thread.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {thread.tags.map(tag => <TagPill key={tag} tag={tag} />)}
                    </div>
                  )}
                  <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-1.5">
                    {thread.author.displayName}
                    {thread.lastPostBy && thread.lastPostBy !== thread.author.displayName && (
                      <> · Last reply by <span className="text-[#6B7280] dark:text-[#888888]">{thread.lastPostBy}</span></>
                    )}
                    {' · '}{timeAgo(thread.lastPostAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs text-[#9CA3AF] dark:text-[#555555]">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />{thread.postCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />{thread.views}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <span className="text-sm text-[#6B7280] dark:text-[#555555]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
