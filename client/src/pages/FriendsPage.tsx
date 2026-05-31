import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserPlus, Users, UserCheck, Search, X, UserMinus, UserRound, Eye } from 'lucide-react';
import { friendsApi, FriendUser, FriendRequest } from '@/api/friends';
import { usersApi } from '@/api/users';
import { FollowUser } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type Tab = 'friends' | 'requests' | 'find' | 'followers' | 'following';

function Avatar({ user, size = 8 }: { user: { displayName: string; avatarColor: string; avatarUrl?: string | null }; size?: number }) {
  const s = `w-${size} h-${size}`;
  if (user.avatarUrl) {
    return <img src={`${apiBase}${user.avatarUrl}`} alt={user.displayName} className={`${s} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div
      className={`${s} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ backgroundColor: user.avatarColor, fontSize: size <= 8 ? 14 : 18 }}
    >
      {user.displayName[0]?.toUpperCase()}
    </div>
  );
}

function FriendCard({ entry, onRemove, onProfile }: {
  entry: { friendshipId: string; user: FriendUser };
  onRemove: (userId: string) => void;
  onProfile: (userId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl">
      <Avatar user={entry.user} size={10} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{entry.user.displayName}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#555555] truncate">@{entry.user.username}</p>
        {entry.user.occupation && (
          <p className="text-xs text-[#6B6B6B] dark:text-[#888888] truncate mt-0.5">{entry.user.occupation}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onProfile(entry.user.id)}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors"
        >
          View Profile
        </button>
        <button
          onClick={() => onRemove(entry.user.id)}
          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-1"
        >
          <UserMinus className="w-3 h-3" />
          Remove
        </button>
      </div>
    </div>
  );
}

function RequestCard({ req, onAccept, onDecline, incoming }: {
  req: FriendRequest;
  onAccept?: (id: string) => void;
  onDecline: (id: string) => void;
  incoming: boolean;
}) {
  const user = incoming ? req.fromUser : req.toUser;
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl">
      <Avatar user={user} size={10} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{user.displayName}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#555555] truncate">@{user.username}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {incoming && onAccept && (
          <button
            onClick={() => onAccept(req.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            Accept
          </button>
        )}
        <button
          onClick={() => onDecline(req.id)}
          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
        >
          {incoming ? 'Decline' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function SearchUserCard({ user, status, onAdd, onAccept, friendshipId }: {
  user: FriendUser;
  status: 'none' | 'sent' | 'incoming' | 'friends';
  onAdd: (userId: string) => void;
  onAccept?: (id: string) => void;
  friendshipId?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl">
      <Avatar user={user} size={10} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{user.displayName}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#555555] truncate">@{user.username}</p>
        {user.occupation && (
          <p className="text-xs text-[#6B6B6B] dark:text-[#888888] truncate mt-0.5">{user.occupation}</p>
        )}
      </div>
      <div className="shrink-0">
        {status === 'none' && (
          <button
            onClick={() => onAdd(user.id)}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#4F46E5] text-white hover:bg-[#4338ca] transition-colors flex items-center gap-1"
          >
            <UserPlus className="w-3 h-3" />
            Add Friend
          </button>
        )}
        {status === 'sent' && (
          <span className="text-xs px-3 py-1.5 rounded-lg bg-[#F0F0F0] dark:bg-[#2A2A2A] text-[#6B7280] dark:text-[#555555]">
            Request Sent
          </span>
        )}
        {status === 'incoming' && onAccept && friendshipId && (
          <button
            onClick={() => onAccept(friendshipId)}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            Accept
          </button>
        )}
        {status === 'friends' && (
          <span className="text-xs px-3 py-1.5 rounded-lg bg-[#F0F0F0] dark:bg-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888]">
            Friends ✓
          </span>
        )}
      </div>
    </div>
  );
}

function FollowUserCard({ u, isFollowing, onFollow, onProfile, pending }: {
  u: FollowUser;
  isFollowing: boolean;
  onFollow: (id: string) => void;
  onProfile: (id: string) => void;
  pending: boolean;
}) {
  const src = u.avatarUrl ? `${apiBase}${u.avatarUrl}` : null;
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl">
      {src ? (
        <img src={src} alt={u.displayName} className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
          style={{ backgroundColor: u.avatarColor, fontSize: 14 }}
        >
          {u.displayName[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{u.displayName}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#555555] truncate">@{u.username}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onProfile(u.id)}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors flex items-center gap-1"
        >
          <Eye className="w-3 h-3" />
          Profile
        </button>
        <button
          onClick={() => onFollow(u.id)}
          disabled={pending}
          className={`group text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 font-medium ${
            isFollowing
              ? 'border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#888888] hover:border-red-300 hover:text-red-500 dark:hover:border-red-800 dark:hover:text-red-400'
              : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
          }`}
        >
          {isFollowing ? (
            <>
              <span className="group-hover:hidden">Following</span>
              <span className="hidden group-hover:inline">Unfollow</span>
            </>
          ) : 'Follow'}
        </button>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('friends');
  const [searchInput, setSearchInput] = useState('');
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({});
  const debouncedSearch = useDebounceValue(searchInput, 300);

  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.getAll(),
    enabled: !!user,
  });

  const { data: requestsData } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => friendsApi.getRequests(),
    enabled: !!user,
  });

  const { data: sentData } = useQuery({
    queryKey: ['friend-sent'],
    queryFn: () => friendsApi.getSent(),
    enabled: !!user,
  });

  const { data: searchData } = useQuery({
    queryKey: ['user-search', debouncedSearch],
    queryFn: () => friendsApi.searchUsers(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });

  const { data: followersData } = useQuery({
    queryKey: ['my-followers', user?.id],
    queryFn: () => usersApi.getFollowers(user!.id),
    enabled: !!user && tab === 'followers',
  });

  const { data: followingData } = useQuery({
    queryKey: ['my-following', user?.id],
    queryFn: () => usersApi.getFollowing(user!.id),
    enabled: !!user && tab === 'following',
  });

  const sendMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.sendRequest(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-sent'] });
      qc.invalidateQueries({ queryKey: ['user-search'] });
      toast.success('Friend request sent!');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'Failed to send request');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => friendsApi.acceptRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      toast.success('Friend request accepted!');
    },
    onError: () => toast.error('Failed to accept request'),
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => friendsApi.declineRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      qc.invalidateQueries({ queryKey: ['friend-sent'] });
    },
    onError: () => toast.error('Failed to decline request'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.removeFriend(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      toast.success('Friend removed');
    },
    onError: () => toast.error('Failed to remove friend'),
  });

  const followMutation = useMutation({
    mutationFn: (uid: string) => usersApi.toggleFollow(uid),
    onMutate: (uid) => {
      setFollowMap(m => ({ ...m, [uid]: !(m[uid] ?? false) }));
    },
    onSuccess: (_res, uid) => {
      qc.invalidateQueries({ queryKey: ['my-followers', user?.id] });
      qc.invalidateQueries({ queryKey: ['my-following', user?.id] });
      if (_res.data) setFollowMap(m => ({ ...m, [uid]: _res.data!.following }));
    },
    onError: (_err, uid) => {
      setFollowMap(m => { const c = { ...m }; delete c[uid]; return c; });
      toast.error('Follow action failed');
    },
  });

  const friends = friendsData?.data ?? [];
  const requests = requestsData?.data ?? [];
  const sent = sentData?.data ?? [];
  const searchResults = searchData?.data ?? [];
  const requestCount = requests.length;
  const myFollowers: FollowUser[] = followersData?.data ?? [];
  const myFollowing: FollowUser[] = followingData?.data ?? [];

  const getFriendshipStatus = useCallback((userId: string): { status: 'none' | 'sent' | 'incoming' | 'friends'; id?: string } => {
    if (friends.some(f => f.user.id === userId)) return { status: 'friends' };
    const sentReq = sent.find(s => s.toUser?.id === userId);
    if (sentReq) return { status: 'sent', id: sentReq.id };
    const incomingReq = requests.find(r => r.fromUser?.id === userId);
    if (incomingReq) return { status: 'incoming', id: incomingReq.id };
    return { status: 'none' };
  }, [friends, sent, requests]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/drive')}
            className="p-2 rounded-lg hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors text-[#6B6B6B] dark:text-[#888888]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Friends</h1>
            <p className="text-sm text-[#6B7280] dark:text-[#555555]">{friends.length} friend{friends.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#F0F0F0] dark:bg-[#1E1E1E] p-1 rounded-xl overflow-x-auto">
          {([
            { id: 'friends',   label: 'Friends',   icon: Users },
            { id: 'requests',  label: `Requests${requestCount > 0 ? ` (${requestCount})` : ''}`, icon: UserCheck },
            { id: 'followers', label: 'Followers',  icon: UserRound },
            { id: 'following', label: 'Following',  icon: Eye },
            { id: 'find',      label: 'Find',       icon: Search },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 flex items-center justify-center gap-1.5 py-2 px-3 text-sm rounded-lg transition-all whitespace-nowrap ${
                tab === id
                  ? 'bg-white dark:bg-[#141414] text-[#0A0A0A] dark:text-[#F5F5F5] font-medium shadow-sm'
                  : 'text-[#6B6B6B] dark:text-[#888888]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* My Friends tab */}
        {tab === 'friends' && (
          <div className="space-y-3">
            {friends.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-10 h-10 mx-auto mb-3 text-[#6B7280] dark:text-[#555555]" />
                <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">No friends yet.</p>
                <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-1">Find people to connect with!</p>
                <button
                  onClick={() => setTab('find')}
                  className="mt-4 text-xs px-4 py-2 rounded-lg bg-[#4F46E5] text-white hover:bg-[#4338ca] transition-colors"
                >
                  Find People
                </button>
              </div>
            ) : (
              friends.map(entry => (
                <FriendCard
                  key={entry.friendshipId}
                  entry={entry}
                  onRemove={id => removeMutation.mutate(id)}
                  onProfile={id => navigate(`/profile/${id}`)}
                />
              ))
            )}
          </div>
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555] mb-3">
                Incoming ({requests.length})
              </h3>
              {requests.length === 0 ? (
                <p className="text-sm text-[#6B7280] dark:text-[#555555] py-4">No incoming requests.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map(req => (
                    <RequestCard
                      key={req.id}
                      req={req}
                      incoming={true}
                      onAccept={id => acceptMutation.mutate(id)}
                      onDecline={id => declineMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555] mb-3">
                Sent ({sent.length})
              </h3>
              {sent.length === 0 ? (
                <p className="text-sm text-[#6B7280] dark:text-[#555555] py-4">No outgoing requests.</p>
              ) : (
                <div className="space-y-3">
                  {sent.map(req => (
                    <RequestCard
                      key={req.id}
                      req={req}
                      incoming={false}
                      onDecline={id => declineMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Followers tab */}
        {tab === 'followers' && (
          <div className="space-y-3">
            {myFollowers.length === 0 ? (
              <div className="text-center py-16">
                <UserRound className="w-10 h-10 mx-auto mb-3 text-[#6B7280] dark:text-[#555555]" />
                <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">No followers yet.</p>
              </div>
            ) : (
              myFollowers.map(u => {
                const isFollowing = followMap[u.id] !== undefined ? followMap[u.id] : u.isFollowing;
                return (
                  <FollowUserCard
                    key={u.id}
                    u={u}
                    isFollowing={isFollowing}
                    onFollow={id => followMutation.mutate(id)}
                    onProfile={id => navigate(`/profile/${id}`)}
                    pending={followMutation.isPending && followMutation.variables === u.id}
                  />
                );
              })
            )}
          </div>
        )}

        {/* Following tab */}
        {tab === 'following' && (
          <div className="space-y-3">
            {myFollowing.length === 0 ? (
              <div className="text-center py-16">
                <Eye className="w-10 h-10 mx-auto mb-3 text-[#6B7280] dark:text-[#555555]" />
                <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">Not following anyone yet.</p>
              </div>
            ) : (
              myFollowing.map(u => {
                const isFollowing = followMap[u.id] !== undefined ? followMap[u.id] : u.isFollowing;
                return (
                  <FollowUserCard
                    key={u.id}
                    u={u}
                    isFollowing={isFollowing}
                    onFollow={id => followMutation.mutate(id)}
                    onProfile={id => navigate(`/profile/${id}`)}
                    pending={followMutation.isPending && followMutation.variables === u.id}
                  />
                );
              })
            )}
          </div>
        )}

        {/* Find People tab */}
        {tab === 'find' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#555555]" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name or username..."
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#AAAAAA] dark:placeholder-[#444444] focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#555555] hover:text-[#6B6B6B] dark:hover:text-[#888888]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {debouncedSearch.length < 2 && (
              <p className="text-sm text-[#6B7280] dark:text-[#555555] text-center py-8">
                Type at least 2 characters to search
              </p>
            )}

            {debouncedSearch.length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-[#6B7280] dark:text-[#555555] text-center py-8">
                No users found for "{debouncedSearch}"
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map(u => {
                  const { status, id: friendshipId } = getFriendshipStatus(u.id);
                  return (
                    <SearchUserCard
                      key={u.id}
                      user={u}
                      status={status}
                      onAdd={id => sendMutation.mutate(id)}
                      onAccept={id => acceptMutation.mutate(id)}
                      friendshipId={friendshipId}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function useDebounceValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
