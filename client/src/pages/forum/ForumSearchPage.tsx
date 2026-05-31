import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, MessageSquare, Eye } from 'lucide-react';
import { forumApi } from '@/api/forum';
import { ForumThread } from '@/types';
import { timeAgo, TagPill, ThreadBadges, Avatar } from './forumUtils';

export default function ForumSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const initialCat = searchParams.get('cat') ?? '';

  const [query, setQuery] = useState(initialQ);
  const [categoryId, setCategoryId] = useState(initialCat);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');

  const { data: catData } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: () => forumApi.getCategories(),
  });
  const categories = catData?.data ?? [];

  const { data: resultsData, isFetching } = useQuery({
    queryKey: ['forum-search', initialQ, initialCat, sort],
    queryFn: () =>
      forumApi.getThreads({ search: initialQ, categoryId: initialCat || undefined, sort, limit: 30 }),
    enabled: !!initialQ,
  });
  const results: ForumThread[] = resultsData?.data?.threads ?? [];
  const total = resultsData?.data?.total ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (query.trim()) params.q = query.trim();
    if (categoryId) params.cat = categoryId;
    setSearchParams(params);
  };

  useEffect(() => {
    setQuery(initialQ);
    setCategoryId(initialCat);
  }, [initialQ, initialCat]);

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
            <span className="text-[#0A0A0A] dark:text-[#F5F5F5] font-medium">Search</span>
          </nav>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Search form */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] dark:text-[#555555]" strokeWidth={1.5} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search threads…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] dark:placeholder-[#444444] focus:outline-none focus:border-[#4F46E5] transition-colors"
            />
          </div>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5] transition-colors"
          >
            <option value="">All categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>

        {/* Sort */}
        {initialQ && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6B7280] dark:text-[#888888]">
              {isFetching ? 'Searching…' : `${total} result${total !== 1 ? 's' : ''} for "${initialQ}"`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9CA3AF] dark:text-[#555555]">Sort:</span>
              {(['latest', 'popular'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    sort === s
                      ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 text-[#4F46E5]'
                      : 'text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E]'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {!initialQ ? (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-12 text-center">
            <Search className="w-8 h-8 text-[#D1D5DB] dark:text-[#333333] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#9CA3AF] dark:text-[#555555]">Enter a search query to find threads</p>
          </div>
        ) : isFetching ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-12 text-center">
            <MessageSquare className="w-8 h-8 text-[#D1D5DB] dark:text-[#333333] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#374151] dark:text-[#888888]">No threads found</p>
            <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-1">Try different keywords or remove filters</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl divide-y divide-[#F3F4F6] dark:divide-[#1E1E1E]">
            {results.map(thread => (
              <div key={thread.id} className="flex items-start gap-3 p-4 hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A] transition-colors">
                <Avatar user={thread.author} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ backgroundColor: thread.category.color + '20', color: thread.category.color }}
                    >
                      {thread.category.name}
                    </span>
                    <ThreadBadges isPinned={thread.isPinned} isLocked={thread.isLocked} isSolved={thread.isSolved} />
                  </div>
                  <Link
                    to={`/forum/thread/${thread.id}`}
                    className="block text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] hover:text-[#4F46E5] transition-colors"
                  >
                    {thread.title}
                  </Link>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-0.5 line-clamp-1">
                    {thread.content.slice(0, 100)}
                  </p>
                  {thread.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {thread.tags.map(tag => <TagPill key={tag} tag={tag} />)}
                    </div>
                  )}
                  <p className="text-xs text-[#9CA3AF] dark:text-[#555555] mt-1">
                    {thread.author.displayName} · {timeAgo(thread.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-[#9CA3AF] dark:text-[#555555]">
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" strokeWidth={1.5} />{thread.postCount}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" strokeWidth={1.5} />{thread.views}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
