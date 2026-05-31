import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, UserCheck, UserPlus } from 'lucide-react';
import { usersApi } from '@/api/users';
import { SuggestedUser } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

function UserCard({ user, onFollowToggle }: { user: SuggestedUser; onFollowToggle: (id: string) => void }) {
  const navigate = useNavigate();
  const initials = user.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-4 flex flex-col gap-3">
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => navigate(`/profile/${user.username}`)}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
          style={{ backgroundColor: user.avatarColor }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate group-hover:text-[#4F46E5] transition-colors">
            {user.displayName}
          </p>
          <p className="text-xs text-[#AAAAAA] dark:text-[#444444] truncate">@{user.username}</p>
        </div>
      </div>

      {(user.occupation || user.location) && (
        <div className="text-[11px] text-[#6B7280] dark:text-[#555555] space-y-0.5">
          {user.occupation && <p className="truncate">{user.occupation}</p>}
          {user.location && <p className="truncate">{user.location}</p>}
        </div>
      )}

      <button
        onClick={() => onFollowToggle(user.id)}
        className={`w-full flex items-center justify-center gap-1.5 h-7 rounded-lg text-xs font-medium transition-colors ${
          user.isFollowing
            ? 'border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#888888] hover:border-red-300 hover:text-red-500'
            : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
        }`}
      >
        {user.isFollowing ? (
          <><UserCheck className="w-3 h-3" strokeWidth={1.5} /> Following</>
        ) : (
          <><UserPlus className="w-3 h-3" strokeWidth={1.5} /> Follow</>
        )}
      </button>
    </div>
  );
}

export default function UserSearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchActive = debouncedQuery.length >= 2;

  const { data: suggestedData, isLoading: suggestedLoading } = useQuery({
    queryKey: ['users-suggested'],
    queryFn: () => usersApi.getSuggested(),
    enabled: !searchActive,
    staleTime: 60_000,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['users-search', debouncedQuery],
    queryFn: () => usersApi.search(debouncedQuery),
    enabled: searchActive,
    staleTime: 30_000,
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => usersApi.toggleFollow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-suggested'] });
      queryClient.invalidateQueries({ queryKey: ['users-search', debouncedQuery] });
    },
  });

  const users: SuggestedUser[] = (searchActive ? searchData?.data : suggestedData?.data) ?? [];
  const isLoading = searchActive ? searchLoading : suggestedLoading;

  const handleFollowToggle = useCallback((id: string) => {
    followMutation.mutate(id);
  }, [followMutation]);

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#6B6B6B] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-[#F8F8F8] dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl px-3 py-2 focus-within:border-[#4F46E5] transition-colors">
          <Search className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] shrink-0" strokeWidth={1.5} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people by name or username…"
            className="flex-1 bg-transparent text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] focus:outline-none"
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Section label */}
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#555555] mb-4">
          {searchActive ? `Results for "${debouncedQuery}"` : 'Suggested People'}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Search className="w-10 h-10 text-[#E5E5E5] dark:text-[#2A2A2A]" strokeWidth={1} />
            <p className="text-sm text-[#6B7280] dark:text-[#555555]">
              {searchActive ? 'No users found' : 'No suggestions yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {users.map(user => (
              <UserCard key={user.id} user={user} onFollowToggle={handleFollowToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
