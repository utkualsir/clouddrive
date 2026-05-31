import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, Plus, MessageSquare, Users, FileText, Wifi, Pin } from 'lucide-react';
import { forumApi } from '@/api/forum';
import { useAuth } from '@/contexts/AuthContext';
import { ForumCategory, ForumThread } from '@/types';
import { CategoryIcon, timeAgo, ThreadBadges, Avatar } from './forumUtils';

export default function ForumHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: statsData } = useQuery({
    queryKey: ['forum-stats'],
    queryFn: () => forumApi.getStats(),
  });
  const stats = statsData?.data;

  const { data: categoriesData, isLoading: catLoading } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: () => forumApi.getCategories(),
  });
  const categories: ForumCategory[] = categoriesData?.data ?? [];

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['forum-threads-recent'],
    queryFn: () => forumApi.getThreads({ sort: 'latest', limit: 10 }),
  });
  const recentThreads: ForumThread[] = recentData?.data?.threads ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) navigate(`/forum/search?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Top bar */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <span className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Community Forum</span>
          <div className="flex-1" />
          {user && (
            <Link
              to="/forum/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              New Thread
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">Community Forum</h1>
          <p className="text-[#6B7280] dark:text-[#888888]">Ask questions, share ideas, help others</p>
          <form onSubmit={handleSearch} className="max-w-lg mx-auto mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] dark:text-[#555555]" strokeWidth={1.5} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search threads…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] dark:placeholder-[#444444] focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
            </div>
          </form>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Threads', value: stats?.threadCount ?? 0, icon: <FileText className="w-4 h-4" strokeWidth={1.5} /> },
            { label: 'Posts', value: stats?.postCount ?? 0, icon: <MessageSquare className="w-4 h-4" strokeWidth={1.5} /> },
            { label: 'Members', value: stats?.memberCount ?? 0, icon: <Users className="w-4 h-4" strokeWidth={1.5} /> },
            { label: 'Online now', value: stats?.onlineCount ?? 0, icon: <Wifi className="w-4 h-4" strokeWidth={1.5} /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center text-[#4F46E5] shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-lg font-bold text-[#0A0A0A] dark:text-[#F5F5F5] leading-none">{value.toLocaleString()}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Categories grid */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555] mb-3">Categories</h2>
          {catLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map(cat => (
                <Link
                  key={cat.id}
                  to={`/forum/category/${cat.id}`}
                  className="group bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-4 hover:border-[#4F46E5] hover:-translate-y-0.5 transition-all duration-150 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <CategoryIcon icon={cat.icon} color={cat.color} size={18} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-[#0A0A0A] dark:text-[#F5F5F5] group-hover:text-[#4F46E5] transition-colors">{cat.name}</p>
                        <span className="text-xs text-[#9CA3AF] dark:text-[#555555] shrink-0">{cat.threadCount} threads</span>
                      </div>
                      <p className="text-xs text-[#6B7280] dark:text-[#888888] mt-0.5">{cat.description}</p>
                    </div>
                  </div>
                  {cat.latestThread && (
                    <div className="border-t border-[#F3F4F6] dark:border-[#1E1E1E] pt-2">
                      <p className="text-xs text-[#9CA3AF] dark:text-[#555555] truncate">
                        <span className="text-[#6B7280] dark:text-[#888888]">{cat.latestThread.title}</span>
                        {' · '}
                        <span>{cat.latestThread.author.displayName}</span>
                        {' · '}
                        <span>{timeAgo(cat.latestThread.lastPostAt)}</span>
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent threads */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555] mb-3">Recent Threads</h2>
          {recentLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentThreads.length === 0 ? (
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-8 text-center">
              <MessageSquare className="w-8 h-8 text-[#D1D5DB] dark:text-[#333333] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[#9CA3AF] dark:text-[#555555]">No threads yet. Be the first to post!</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl divide-y divide-[#F3F4F6] dark:divide-[#1E1E1E]">
              {recentThreads.map(thread => (
                <div key={thread.id} className="flex items-start gap-3 p-4 hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A] transition-colors">
                  <Avatar user={thread.author} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ backgroundColor: thread.category.color + '20', color: thread.category.color }}
                      >
                        {thread.category.name}
                      </span>
                      {thread.isPinned && <Pin className="w-3 h-3 text-[#4F46E5]" />}
                    </div>
                    <Link
                      to={`/forum/thread/${thread.id}`}
                      className="block mt-0.5 text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5] hover:text-[#4F46E5] transition-colors line-clamp-1"
                    >
                      {thread.title}
                    </Link>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-0.5">
                      {thread.author.displayName} · {timeAgo(thread.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-[#9CA3AF] dark:text-[#555555]">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />{thread.postCount}
                    </span>
                    <span className="flex items-center gap-1 hidden sm:flex">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" strokeWidth={1.5} stroke="currentColor">
                        <path d="M8 3C4.5 3 1.5 5.5 1.5 8s3 5 6.5 5 6.5-2.5 6.5-5-3-5-6.5-5z" />
                        <circle cx="8" cy="8" r="1.5" />
                      </svg>
                      {thread.views}
                    </span>
                    <ThreadBadges isPinned={false} isLocked={thread.isLocked} isSolved={thread.isSolved} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
