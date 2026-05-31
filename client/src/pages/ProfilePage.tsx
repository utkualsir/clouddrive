import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Globe, Briefcase, GraduationCap, Calendar, Heart,
  Mail, ArrowLeft, Edit2, Camera, X, Plus, UserPlus, UserCheck,
  UserMinus, Users, Music, Dumbbell, Trophy, Languages, Home,
  Eye, FileText, Download, CheckCircle, Loader2, Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, UpdateProfilePayload } from '@/api/users';
import { UserProfile, PublicFile, FollowUser, FileVisibility } from '@/types';
import { friendsApi, FriendUser } from '@/api/friends';
import { forumApi } from '@/api/forum';
import { FileTypeTag } from '@/components/FileIcon';
import toast from 'react-hot-toast';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const BADGE_META: Record<string, { label: string; emoji: string; description: string }> = {
  early_adopter: { label: 'Early Adopter',  emoji: '🚀', description: 'Joined CloudDrive early' },
  first_upload:  { label: 'First Upload',   emoji: '📁', description: 'Uploaded their first file' },
  power_user:    { label: 'Power User',     emoji: '⚡', description: 'Uploaded 10+ files' },
  storage_pro:   { label: 'Storage Pro',    emoji: '💾', description: 'Used over 1 GB of storage' },
  sharer:        { label: 'Sharer',         emoji: '🔗', description: 'Shared their first file' },
  organizer:     { label: 'Organizer',      emoji: '📂', description: 'Created 5+ folders' },
};
const ALL_BADGE_TYPES = Object.keys(BADGE_META);

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const RELATIONSHIP_OPTIONS = ['Single', 'In a relationship', 'Engaged', 'Married', 'Complicated', 'Prefer not to say'];

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo (Democratic Republic)','Congo (Republic)','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea',
  'Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany',
  'Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives',
  'Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco',
  'Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan',
  'Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone',
  'Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan',
  'Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania',
  'Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

type TabId = 'about' | 'files' | 'friends' | 'badges';
type EditTab = 'basic' | 'personal' | 'work' | 'interests' | 'privacy';

function formatBytes(bytes: string | number): string {
  const n = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
}

function Pill({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    pink:   'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
    green:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    amber:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  };
  return (
    <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${colors[color] ?? colors.indigo}`}>
      {label}
    </span>
  );
}

function AvatarCircle({
  user, size = 40,
}: { user: { displayName: string; avatarColor: string; avatarUrl: string | null; id: string }; size?: number }) {
  const src = user.avatarUrl ? `${apiBase}${user.avatarUrl}` : null;
  const style = { width: size, height: size, backgroundColor: user.avatarColor };
  const fontSize = Math.max(10, size * 0.36);
  if (src) {
    return <img src={src} alt={user.displayName} style={style} className="rounded-full object-cover" />;
  }
  return (
    <div style={{ ...style, fontSize }} className="rounded-full flex items-center justify-center text-white font-bold shrink-0">
      {user.displayName[0]?.toUpperCase()}
    </div>
  );
}

const TAG_PILL_CLASSES: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  pink:   'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function TagInput({
  values, onAdd, onRemove, placeholder, pillColor, max = 10,
}: {
  values: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void;
  placeholder: string; pillColor: string; max?: number;
}) {
  const [input, setInput] = useState('');
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || values.length >= max) return;
    onAdd(v);
    setInput('');
  };
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
    if (e.key === 'Backspace' && !input && values.length > 0) { e.preventDefault(); onRemove(values.length - 1); }
  };
  const pillClass = TAG_PILL_CLASSES[pillColor] ?? TAG_PILL_CLASSES.indigo;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={values.length >= max ? `Max ${max} tags` : placeholder}
          disabled={values.length >= max}
          className="flex-1 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors disabled:opacity-50"
        />
        <button type="button" onClick={() => add(input)} disabled={!input.trim() || values.length >= max} className="px-3 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm transition-colors disabled:opacity-40">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span key={i} className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium ${pillClass}`}>
              {v}
              <button type="button" onClick={() => onRemove(i)} className="hover:opacity-60 transition-opacity ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-[#4F46E5]' : 'bg-[#D1D5DB] dark:bg-[#2A2A2A]'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOwn = authUser?.id === userId;

  const [activeTab, setActiveTab] = useState<TabId>('about');
  const [fileVisibilityFilter, setFileVisibilityFilter] = useState<FileVisibility | 'all'>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>('basic');
  const [form, setForm] = useState<UpdateProfilePayload>({});
  const [friendSearch, setFriendSearch] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [followListModal, setFollowListModal] = useState<{ tab: 'followers' | 'following' } | null>(null);
  const [followListSearch, setFollowListSearch] = useState('');
  const [optimisticFollow, setOptimisticFollow] = useState<boolean | null>(null);
  const [optimisticFollowerCount, setOptimisticFollowerCount] = useState<number | null>(null);
  const [modalFollowMap, setModalFollowMap] = useState<Record<string, boolean>>({});

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Profile query
  const { data, isPending, isError } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => usersApi.getProfile(userId!),
    enabled: !!userId,
  });
  const profile = data?.data as UserProfile | undefined;

  // Forum stats for this profile
  const { data: forumStatsData } = useQuery({
    queryKey: ['forum-user-stats', userId],
    queryFn: () => forumApi.getUserStats(userId!),
    enabled: !!userId,
  });
  const forumStats = forumStatsData?.data;

  // Friends list for this profile
  const { data: friendsListData } = useQuery({
    queryKey: ['profile-friends', userId],
    queryFn: () => usersApi.getFriendsList(userId!),
    enabled: !!userId,
  });
  const profileFriends: FriendUser[] = friendsListData?.data ?? [];

  // Public files for files tab
  const { data: publicFilesData, isLoading: filesLoading } = useQuery({
    queryKey: ['profile-files', userId],
    queryFn: () => usersApi.getPublicFiles(userId!),
    enabled: !!userId && activeTab === 'files',
  });
  const publicFiles: PublicFile[] = publicFilesData?.data ?? [];

  // Friendship state (only for other users when logged in)
  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.getAll(),
    enabled: !!authUser && !isOwn,
  });
  const { data: sentData } = useQuery({
    queryKey: ['friend-sent'],
    queryFn: () => friendsApi.getSent(),
    enabled: !!authUser && !isOwn,
  });
  const { data: requestsData } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => friendsApi.getRequests(),
    enabled: !!authUser && !isOwn,
  });
  const myFriends = friendsData?.data ?? [];
  const sent = sentData?.data ?? [];
  const requests = requestsData?.data ?? [];
  const isFriend = myFriends.some(f => f.user.id === userId);
  const sentReq = sent.find(s => s.toUser?.id === userId);
  const incomingReq = requests.find(r => r.fromUser?.id === userId);

  // Mutations
  const avatarMutation = useMutation({
    mutationFn: usersApi.uploadAvatar,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profile', userId] }); toast.success('Avatar updated!'); },
    onError: () => toast.error('Failed to upload avatar'),
  });
  const coverMutation = useMutation({
    mutationFn: usersApi.uploadCover,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profile', userId] }); toast.success('Cover photo updated!'); },
    onError: () => toast.error('Failed to upload cover'),
  });
  const updateMutation = useMutation({
    mutationFn: usersApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      setEditOpen(false);
      toast.success('Profile updated!');
    },
  });

  const autoSaveMutation = useMutation({
    mutationFn: usersApi.updateProfile,
    onError: () => toast.error('Auto-save failed'),
  });

  const handlePrivacyToggle = (key: keyof UpdateProfilePayload, value: boolean) => {
    setForm(f => ({ ...f, [key]: value }));
    autoSaveMutation.mutate({ [key]: value });
  };
  const bioMutation = useMutation({
    mutationFn: (bio: string) => usersApi.updateProfile({ bio }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profile', userId] }); setEditingBio(false); },
    onError: () => toast.error('Failed to save bio'),
  });
  const sendMutation = useMutation({
    mutationFn: () => friendsApi.sendRequest(userId!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['friend-sent'] }); toast.success('Friend request sent!'); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'Failed to send request');
    },
  });
  const acceptMutation = useMutation({
    mutationFn: (id: string) => friendsApi.acceptRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      toast.success('Friend request accepted!');
    },
  });
  const removeMutation = useMutation({
    mutationFn: () => friendsApi.removeFriend(userId!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['friends'] }); toast.success('Friend removed'); },
  });

  const followMutation = useMutation({
    mutationFn: () => usersApi.toggleFollow(userId!),
    onMutate: () => {
      const wasFollowing = optimisticFollow ?? profile?.isFollowing ?? false;
      const count = optimisticFollowerCount ?? profile?.followerCount ?? 0;
      setOptimisticFollow(!wasFollowing);
      setOptimisticFollowerCount(wasFollowing ? Math.max(0, count - 1) : count + 1);
    },
    onSuccess: (res) => {
      if (res.data) {
        setOptimisticFollow(res.data.following);
        setOptimisticFollowerCount(res.data.followerCount);
      }
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: () => {
      setOptimisticFollow(null);
      setOptimisticFollowerCount(null);
      toast.error('Follow action failed');
    },
  });

  const modalFollowMutation = useMutation({
    mutationFn: (uid: string) => usersApi.toggleFollow(uid),
    onMutate: (uid) => {
      setModalFollowMap(m => ({ ...m, [uid]: !(m[uid] ?? false) }));
    },
    onError: (_err, uid) => {
      setModalFollowMap(m => { const copy = { ...m }; delete copy[uid]; return copy; });
      toast.error('Follow action failed');
    },
  });

  const { data: followersListData } = useQuery({
    queryKey: ['profile-followers', userId],
    queryFn: () => usersApi.getFollowers(userId!),
    enabled: !!userId && followListModal !== null,
  });
  const { data: followingListData } = useQuery({
    queryKey: ['profile-following', userId],
    queryFn: () => usersApi.getFollowing(userId!),
    enabled: !!userId && followListModal !== null,
  });
  const rawModalUsers: FollowUser[] = (followListModal?.tab === 'followers' ? followersListData?.data : followingListData?.data) ?? [];
  const filteredModalUsers = followListSearch
    ? rawModalUsers.filter(u =>
        u.displayName.toLowerCase().includes(followListSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(followListSearch.toLowerCase()),
      )
    : rawModalUsers;

  function openEdit() {
    if (!profile) return;
    setForm({
      displayName: profile.displayName,
      username: profile.username,
      bio: profile.bio ?? '',
      currentCity: profile.currentCity ?? '',
      hometown: profile.hometown ?? '',
      country: profile.country ?? '',
      website: profile.website ?? '',
      birthDate: profile.birthDate ?? null,
      gender: profile.gender ?? '',
      relationshipStatus: profile.relationshipStatus ?? '',
      hobbies: profile.hobbies ?? [],
      favoriteMusic: profile.favoriteMusic ?? [],
      favoriteSports: profile.favoriteSports ?? [],
      favoriteTeam: profile.favoriteTeam ?? '',
      languages: profile.languages ?? [],
      occupation: profile.occupation ?? '',
      company: profile.company ?? '',
      school: profile.school ?? '',
      university: profile.university ?? '',
      showBirthDate: profile.showBirthDate ?? false,
      showGender: profile.showGender ?? false,
      showRelationship: profile.showRelationship ?? false,
      showEmail: profile.showEmail ?? false,
      emailNotifications: profile.emailNotifications ?? true,
      newSigninAlerts: profile.newSigninAlerts ?? true,
      storageWarnings: profile.storageWarnings ?? true,
    });
    setUsernameStatus('idle');
    setEditTab('basic');
    setEditOpen(true);
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5] dark:bg-[#0A0A0A]">
        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F0F2F5] dark:bg-[#0A0A0A]">
        <p className="text-[#6B6B6B] dark:text-[#888888]">Profile not found.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-[#4F46E5] hover:underline">Go back</button>
      </div>
    );
  }

  const coverSrc = profile.coverPhotoUrl ? `${apiBase}${profile.coverPhotoUrl}?t=${Date.now()}` : null;
  const avatarSrc = profile.avatarUrl ? `${apiBase}${profile.avatarUrl}?t=${Date.now()}` : null;
  const locationLine = [profile.currentCity, profile.country].filter(Boolean).join(', ');

  const filteredFriends = profileFriends.filter(f =>
    !friendSearch || f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) || f.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: 'about', label: 'About' },
    { id: 'files', label: `Files${profile.totalFiles > 0 ? ` (${profile.totalFiles})` : ''}` },
    { id: 'friends', label: `Friends${profileFriends.length > 0 ? ` (${profileFriends.length})` : ''}` },
    { id: 'badges', label: 'Badges' },
  ];

  const editTabs: { id: EditTab; label: string }[] = [
    { id: 'basic', label: 'Basic' },
    { id: 'personal', label: 'Personal' },
    { id: 'work', label: 'Work & School' },
    { id: 'interests', label: 'Interests' },
    { id: 'privacy', label: 'Privacy' },
  ];

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#0A0A0A]">
      {/* Back button */}
      <div className="fixed top-4 left-4 z-20">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white dark:bg-[#1E1E1E] shadow text-[#6B6B6B] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Cover photo */}
      <div className="relative w-full h-[280px] bg-gradient-to-br from-[#4F46E5] via-[#7c3aed] to-[#ec4899] overflow-hidden">
        {coverSrc && (
          <img src={coverSrc} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {isOwn && (
          <>
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={coverMutation.isPending}
              className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm transition-colors disabled:opacity-60"
            >
              <Camera className="w-3.5 h-3.5" />
              {coverMutation.isPending ? 'Uploading…' : 'Change cover'}
            </button>
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) coverMutation.mutate(f); e.target.value = ''; }} />
          </>
        )}
      </div>

      {/* Profile content */}
      <div className="max-w-4xl mx-auto px-4">
        {/* Header row — avatar + name + buttons */}
        <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 -mt-[60px] pb-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          {/* Avatar */}
          <div className="relative z-10 shrink-0">
            <div className="w-[120px] h-[120px] rounded-full ring-4 ring-white dark:ring-[#0A0A0A] overflow-hidden bg-[#4F46E5] flex items-center justify-center text-white text-4xl font-bold shadow-lg">
              {avatarSrc ? (
                <img src={avatarSrc} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{profile.displayName[0]?.toUpperCase()}</span>
              )}
            </div>
            {isOwn && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarMutation.isPending}
                  className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) avatarMutation.mutate(f); e.target.value = ''; }} />
              </>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 sm:pb-2">
            <h1 className="text-2xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] leading-tight">{profile.displayName}</h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">@{profile.username}</p>
            <div className="mt-1 flex items-center gap-4">
              <button
                onClick={() => { setFollowListModal({ tab: 'followers' }); setFollowListSearch(''); setModalFollowMap({}); }}
                className="text-sm hover:underline"
              >
                <span className="font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">{optimisticFollowerCount ?? profile.followerCount}</span>
                <span className="text-[#6B7280] dark:text-[#555555] ml-1">followers</span>
              </button>
              <button
                onClick={() => { setFollowListModal({ tab: 'following' }); setFollowListSearch(''); setModalFollowMap({}); }}
                className="text-sm hover:underline"
              >
                <span className="font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">{profile.followingCount}</span>
                <span className="text-[#6B7280] dark:text-[#555555] ml-1">following</span>
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {locationLine && (
                <span className="flex items-center gap-1 text-xs text-[#6B6B6B] dark:text-[#888888]">
                  <MapPin className="w-3 h-3" strokeWidth={1.5} />{locationLine}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-[#AAAAAA] dark:text-[#444444]">
                <Eye className="w-3 h-3" strokeWidth={1.5} />{profile.profileViews} views
              </span>
              {forumStats && (forumStats.threadCount > 0 || forumStats.postCount > 0) && (
                <Link to="/forum" className="flex items-center gap-1 text-xs text-[#AAAAAA] dark:text-[#444444] hover:text-[#4F46E5] transition-colors">
                  {forumStats.threadCount} threads · {forumStats.postCount} posts
                </Link>
              )}
              <span className="text-xs text-[#AAAAAA] dark:text-[#444444]">
                Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="sm:pb-2 flex gap-2 flex-wrap">
            {isOwn ? (
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            ) : authUser ? (
              <>
                {isFriend ? (
                  <button
                    onClick={() => removeMutation.mutate()}
                    disabled={removeMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    {removeMutation.isPending ? 'Removing…' : 'Friends'}
                  </button>
                ) : incomingReq ? (
                  <button
                    onClick={() => acceptMutation.mutate(incomingReq.id)}
                    disabled={acceptMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {acceptMutation.isPending ? 'Accepting…' : 'Accept Request'}
                  </button>
                ) : sentReq ? (
                  <span className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-[#F0F0F0] dark:bg-[#2A2A2A] text-[#AAAAAA] dark:text-[#444444]">
                    <UserCheck className="w-3.5 h-3.5" />Request Sent
                  </span>
                ) : (
                  <button
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {sendMutation.isPending ? 'Sending…' : 'Add Friend'}
                  </button>
                )}
                {/* Follow button — independent of friendship */}
                {(() => {
                  const isFollowing = optimisticFollow ?? profile.isFollowing;
                  return (
                    <button
                      onClick={() => followMutation.mutate()}
                      disabled={followMutation.isPending}
                      className={`group flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
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
                  );
                })()}
              </>
            ) : null}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] rounded-b-none mt-0 px-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-[#4F46E5] text-[#4F46E5] dark:text-[#6366f1]'
                  : 'border-transparent text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-4 pb-12">
          {/* ─── ABOUT TAB ─── */}
          {activeTab === 'about' && (
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
              {/* Left column */}
              <div className="space-y-4">
                {/* Bio card */}
                <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444] mb-3">Bio</p>
                  {editingBio && isOwn ? (
                    <div className="space-y-2">
                      <textarea
                        value={bioInput}
                        onChange={e => setBioInput(e.target.value)}
                        rows={4}
                        autoFocus
                        placeholder="Tell people about yourself…"
                        className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] resize-none transition-colors"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => bioMutation.mutate(bioInput)} disabled={bioMutation.isPending} className="px-3 py-1.5 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-60">
                          {bioMutation.isPending ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingBio(false)} className="px-3 py-1.5 text-xs border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] rounded-lg hover:border-[#AAAAAA] transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : profile.bio ? (
                    <div className="group relative">
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5] leading-relaxed">{profile.bio}</p>
                      {isOwn && (
                        <button onClick={() => { setBioInput(profile.bio ?? ''); setEditingBio(true); }} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 text-[#AAAAAA] hover:text-[#4F46E5] transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : isOwn ? (
                    <button onClick={() => { setBioInput(''); setEditingBio(true); }} className="w-full py-4 text-sm text-[#AAAAAA] dark:text-[#444444] border-2 border-dashed border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl hover:border-[#4F46E5] hover:text-[#4F46E5] transition-colors">
                      + Add a bio
                    </button>
                  ) : (
                    <p className="text-sm text-[#AAAAAA] dark:text-[#444444] italic">No bio yet.</p>
                  )}
                </div>

                {/* Details card */}
                <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 space-y-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444]">Details</p>
                  {locationLine && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">Lives in <span className="font-medium">{locationLine}</span></p>
                    </div>
                  )}
                  {profile.hometown && (
                    <div className="flex items-start gap-2.5">
                      <Home className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">From <span className="font-medium">{profile.hometown}</span></p>
                    </div>
                  )}
                  {(profile.occupation || profile.company) && (
                    <div className="flex items-start gap-2.5">
                      <Briefcase className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">
                        {profile.occupation}{profile.occupation && profile.company ? ' at ' : ''}<span className="font-medium">{profile.company}</span>
                      </p>
                    </div>
                  )}
                  {(profile.university || profile.school) && (
                    <div className="flex items-start gap-2.5">
                      <GraduationCap className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">{[profile.university, profile.school].filter(Boolean).join(' / ')}</p>
                    </div>
                  )}
                  {profile.relationshipStatus && (
                    <div className="flex items-start gap-2.5">
                      <Heart className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">{profile.relationshipStatus}</p>
                    </div>
                  )}
                  {profile.birthDate && (
                    <div className="flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">
                        {new Date(profile.birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-start gap-2.5">
                      <Globe className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-[#4F46E5] hover:underline break-all">{profile.website}</a>
                    </div>
                  )}
                  {profile.email && (
                    <div className="flex items-start gap-2.5">
                      <Mail className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">{profile.email}</p>
                    </div>
                  )}
                  {profile.languages && profile.languages.length > 0 && (
                    <div className="flex items-start gap-2.5">
                      <Languages className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] mt-0.5 shrink-0" strokeWidth={1.5} />
                      <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">Speaks {profile.languages.join(', ')}</p>
                    </div>
                  )}
                  {!locationLine && !profile.hometown && !profile.occupation && !profile.company && !profile.university && !profile.school && !profile.relationshipStatus && !profile.birthDate && !profile.website && !profile.email && !(profile.languages?.length) && (
                    <p className="text-xs text-[#AAAAAA] dark:text-[#444444] italic">Nothing to show here.</p>
                  )}
                </div>

                {/* Interests card */}
                {(profile.hobbies.length > 0 || profile.favoriteMusic.length > 0 || profile.favoriteSports.length > 0 || profile.favoriteTeam) && (
                  <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444]">Interests</p>
                    {profile.hobbies.length > 0 && (
                      <div>
                        <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mb-2">Hobbies</p>
                        <div className="flex flex-wrap gap-1.5">{profile.hobbies.map((h, i) => <Pill key={i} label={h} color="indigo" />)}</div>
                      </div>
                    )}
                    {profile.favoriteMusic.length > 0 && (
                      <div>
                        <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mb-2 flex items-center gap-1"><Music className="w-3 h-3" strokeWidth={1.5} />Favorite Music</p>
                        <div className="flex flex-wrap gap-1.5">{profile.favoriteMusic.map((m, i) => <Pill key={i} label={m} color="pink" />)}</div>
                      </div>
                    )}
                    {profile.favoriteSports.length > 0 && (
                      <div>
                        <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mb-2 flex items-center gap-1"><Dumbbell className="w-3 h-3" strokeWidth={1.5} />Favorite Sports</p>
                        <div className="flex flex-wrap gap-1.5">{profile.favoriteSports.map((s, i) => <Pill key={i} label={s} color="green" />)}</div>
                      </div>
                    )}
                    {profile.favoriteTeam && (
                      <div>
                        <p className="text-xs text-[#AAAAAA] dark:text-[#444444] mb-2 flex items-center gap-1"><Trophy className="w-3 h-3" strokeWidth={1.5} />Favorite Team</p>
                        <Pill label={`⚽ ${profile.favoriteTeam}`} color="amber" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Friends preview */}
                {profileFriends.length > 0 && (
                  <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444]">Friends</p>
                      <button onClick={() => setActiveTab('friends')} className="text-xs text-[#4F46E5] hover:underline">{profileFriends.length} total</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {profileFriends.slice(0, 6).map(f => (
                        <Link key={f.id} to={`/profile/${f.id}`} className="group flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors">
                          <AvatarCircle user={{ ...f, avatarUrl: f.avatarUrl ?? null }} size={48} />
                          <span className="text-[10px] text-[#6B6B6B] dark:text-[#888888] truncate w-full text-center group-hover:text-[#0A0A0A] dark:group-hover:text-[#F5F5F5]">{f.displayName}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Badges */}
                {profile.badges.length > 0 && (
                  <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444] mb-3">Badges</p>
                    <div className="grid grid-cols-2 gap-2">
                      {profile.badges.slice(0, 4).map(b => {
                        const meta = BADGE_META[b.type] ?? { label: b.type, emoji: '🏅', description: '' };
                        return (
                          <div key={b.id} title={meta.description} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#0D0D0D]">
                            <span className="text-base">{meta.emoji}</span>
                            <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{meta.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    {profile.badges.length > 4 && (
                      <button onClick={() => setActiveTab('badges')} className="mt-2 text-xs text-[#4F46E5] hover:underline">See all {profile.badges.length} badges</button>
                    )}
                  </div>
                )}

                {/* Storage stats — own profile only */}
                {isOwn && (
                  <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444] mb-3">Storage</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-[#6B6B6B] dark:text-[#888888]">
                        <span>{formatBytes(profile.storageUsed)}</span>
                        <span>{profile.storageLimit ? formatBytes(profile.storageLimit) : '5 GB'}</span>
                      </div>
                      <div className="h-2 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#4F46E5] transition-all"
                          style={{ width: `${Math.min(100, (parseInt(profile.storageUsed) / parseInt(profile.storageLimit ?? '5368709120')) * 100).toFixed(1)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#AAAAAA] dark:text-[#444444]">{profile.totalFiles} files uploaded</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── FILES TAB ─── */}
          {activeTab === 'files' && (() => {
            const VISIBILITY_META: Record<FileVisibility, { label: string; icon: typeof Globe; color: string }> = {
              PUBLIC:  { label: 'Public',  icon: Globe,  color: 'text-green-500' },
              FRIENDS: { label: 'Friends', icon: Users,  color: 'text-blue-500' },
              PRIVATE: { label: 'Private', icon: Lock,   color: 'text-[#9CA3AF]' },
            };
            const filteredFiles = fileVisibilityFilter === 'all'
              ? publicFiles
              : publicFiles.filter(f => f.visibility === fileVisibilityFilter);
            const filterOptions: (FileVisibility | 'all')[] = ['all', 'PUBLIC', 'FRIENDS', 'PRIVATE'];
            return (
              <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444]">Files</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {filterOptions.map(opt => {
                      const active = fileVisibilityFilter === opt;
                      const meta = opt !== 'all' ? VISIBILITY_META[opt] : null;
                      const Icon = meta?.icon;
                      return (
                        <button
                          key={opt}
                          onClick={() => setFileVisibilityFilter(opt)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                            active
                              ? 'bg-[#4F46E5] text-white'
                              : 'bg-[#F3F4F6] dark:bg-[#1E1E1E] text-[#6B7280] dark:text-[#555555] hover:bg-[#E5E7EB] dark:hover:bg-[#252525]'
                          }`}
                        >
                          {Icon && <Icon className="w-3 h-3" strokeWidth={1.5} />}
                          {opt === 'all' ? 'All' : VISIBILITY_META[opt].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {filesLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-[#F0F0F0] dark:bg-[#1E1E1E] animate-pulse" />)}
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <FileText className="w-10 h-10 text-[#E5E5E5] dark:text-[#2A2A2A]" strokeWidth={1} />
                    <p className="text-sm text-[#AAAAAA] dark:text-[#444444]">No files here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredFiles.map(file => {
                      const vis = (file.visibility ?? 'PRIVATE') as FileVisibility;
                      const visMeta = VISIBILITY_META[vis];
                      const VisIcon = visMeta.icon;
                      return (
                        <div
                          key={file.id}
                          className="group flex flex-col gap-2 p-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <FileTypeTag mimeType={file.mimeType} size="md" />
                            <span className={`flex items-center gap-0.5 text-[10px] font-medium ${visMeta.color}`}>
                              <VisIcon className="w-2.5 h-2.5" strokeWidth={1.5} />
                              {visMeta.label}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{file.originalName}</p>
                          <p className="text-[10px] text-[#AAAAAA] dark:text-[#444444]">{formatBytes(file.size)}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[#AAAAAA] dark:text-[#444444]">
                            <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{file.shareViews}</span>
                            <span className="flex items-center gap-0.5"><Download className="w-2.5 h-2.5" />{file.downloadCount}</span>
                            {file.shareToken && (
                              <a href={`/share/${file.shareToken}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-[#4F46E5] hover:underline">Share link</a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─── FRIENDS TAB ─── */}
          {activeTab === 'friends' && (
            <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5">
              <div className="flex items-center justify-between mb-4 gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444] shrink-0">
                  {profileFriends.length} Friends
                </p>
                <input
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Search friends…"
                  className="flex-1 max-w-xs rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-1.5 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors"
                />
              </div>
              {filteredFriends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Users className="w-10 h-10 text-[#E5E5E5] dark:text-[#2A2A2A]" strokeWidth={1} />
                  <p className="text-sm text-[#AAAAAA] dark:text-[#444444]">
                    {friendSearch ? 'No friends match your search.' : 'No friends yet.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredFriends.map(f => (
                    <Link
                      key={f.id}
                      to={`/profile/${f.id}`}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] transition-colors"
                    >
                      <AvatarCircle user={{ ...f, avatarUrl: f.avatarUrl ?? null }} size={40} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate group-hover:text-[#4F46E5]">{f.displayName}</p>
                        <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444] truncate">@{f.username}</p>
                        {f.occupation && <p className="text-[10px] text-[#AAAAAA] dark:text-[#444444] truncate">{f.occupation}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── BADGES TAB ─── */}
          {activeTab === 'badges' && (
            <div className="bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444] mb-4">Badges</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ALL_BADGE_TYPES.map(type => {
                  const meta = BADGE_META[type]!;
                  const earned = profile.badges.find(b => b.type === type);
                  return (
                    <div
                      key={type}
                      title={meta.description}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors ${earned ? 'border-[#4F46E5]/30 bg-[#EEF2FF] dark:bg-[#1e1b4b]/20' : 'border-[#E5E5E5] dark:border-[#2A2A2A] opacity-40 grayscale'}`}
                    >
                      <span className="text-2xl">{meta.emoji}</span>
                      <div>
                        <p className="text-xs font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">{meta.label}</p>
                        <p className="text-[10px] text-[#AAAAAA] dark:text-[#444444]">
                          {earned ? new Date(earned.earnedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Locked'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── EDIT PROFILE MODAL ─── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-[600px] bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-2xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0">
              <h2 className="flex-1 text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 px-3 pt-3 shrink-0 border-b border-[#E5E5E5] dark:border-[#2A2A2A] overflow-x-auto no-scrollbar">
              {editTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setEditTab(t.id)}
                  className={`px-3 pb-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    editTab === t.id
                      ? 'border-[#4F46E5] text-[#4F46E5] dark:text-[#6366f1]'
                      : 'border-transparent text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* TAB 1 — Basic Info */}
              {editTab === 'basic' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Display Name <span className="text-red-500">*</span></span>
                    <input
                      value={form.displayName ?? ''}
                      onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="Your name"
                      className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Username</span>
                    <div className="relative mt-1">
                      <input
                        value={form.username ?? ''}
                        onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setUsernameStatus('idle'); }}
                        onBlur={() => {
                          const u = (form.username ?? '').trim();
                          if (!u || u === profile?.username) { setUsernameStatus('idle'); return; }
                          setUsernameStatus('checking');
                          usersApi.checkUsername(u)
                            .then(r => setUsernameStatus(r.data?.available ? 'available' : 'taken'))
                            .catch(() => setUsernameStatus('idle'));
                        }}
                        placeholder="username"
                        className={`w-full rounded-xl border bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 pr-9 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none transition-colors ${
                          usernameStatus === 'available' ? 'border-green-400 focus:border-green-400' :
                          usernameStatus === 'taken'     ? 'border-red-400 focus:border-red-400' :
                          'border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5]'
                        }`}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {usernameStatus === 'checking'  && <Loader2 className="w-3.5 h-3.5 text-[#AAAAAA] animate-spin" />}
                        {usernameStatus === 'available' && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                        {usernameStatus === 'taken'     && <X className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>
                    {usernameStatus === 'taken'     && <p className="text-xs text-red-500 mt-1">This username is already taken</p>}
                    {usernameStatus === 'available' && <p className="text-xs text-green-500 mt-1">Username is available</p>}
                  </label>

                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Bio</span>
                      <span className={`text-xs ${(form.bio?.length ?? 0) > 180 ? 'text-red-500' : 'text-[#6B7280] dark:text-[#555555]'}`}>
                        {form.bio?.length ?? 0} / 200
                      </span>
                    </div>
                    <textarea
                      value={form.bio ?? ''}
                      onChange={e => { if (e.target.value.length <= 200) setForm(f => ({ ...f, bio: e.target.value })); }}
                      rows={3}
                      placeholder="Tell us about yourself…"
                      className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] resize-none transition-colors"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Website</span>
                    <input value={form.website ?? ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://" className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Current City</span>
                    <input value={form.currentCity ?? ''} onChange={e => setForm(f => ({ ...f, currentCity: e.target.value }))} placeholder="New York" className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Hometown</span>
                    <input value={form.hometown ?? ''} onChange={e => setForm(f => ({ ...f, hometown: e.target.value }))} placeholder="Chicago" className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Country</span>
                    <select value={form.country ?? ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5] transition-colors">
                      <option value="">Select country…</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </>
              )}

              {/* TAB 2 — Personal */}
              {editTab === 'personal' && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Birth Date</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6B7280] dark:text-[#555555]">Show on profile</span>
                        <Toggle value={form.showBirthDate ?? false} onChange={v => handlePrivacyToggle('showBirthDate', v)} />
                      </div>
                    </div>
                    <input type="date" value={form.birthDate ? (form.birthDate as string).split('T')[0] : ''} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value || null }))} className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Gender</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6B7280] dark:text-[#555555]">Show on profile</span>
                        <Toggle value={form.showGender ?? false} onChange={v => handlePrivacyToggle('showGender', v)} />
                      </div>
                    </div>
                    <select value={form.gender ?? ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5] transition-colors">
                      <option value="">Not specified</option>
                      {GENDER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Relationship Status</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6B7280] dark:text-[#555555]">Show on profile</span>
                        <Toggle value={form.showRelationship ?? false} onChange={v => handlePrivacyToggle('showRelationship', v)} />
                      </div>
                    </div>
                    <select value={form.relationshipStatus ?? ''} onChange={e => setForm(f => ({ ...f, relationshipStatus: e.target.value }))} className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5] transition-colors">
                      <option value="">Not specified</option>
                      {RELATIONSHIP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Languages className="w-3 h-3 text-[#6B7280]" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Languages</span>
                    </div>
                    <TagInput
                      values={form.languages ?? []}
                      onAdd={v => setForm(f => ({ ...f, languages: [...(f.languages ?? []), v] }))}
                      onRemove={i => setForm(f => ({ ...f, languages: (f.languages ?? []).filter((_, idx) => idx !== i) }))}
                      placeholder="Add a language…"
                      pillColor="indigo"
                    />
                  </div>
                </>
              )}

              {/* TAB 3 — Work & Education */}
              {editTab === 'work' && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Occupation</span>
                    <input value={form.occupation ?? ''} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} placeholder="Software Engineer" className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Company</span>
                    <input value={form.company ?? ''} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Google" className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">School</span>
                    <input value={form.school ?? ''} onChange={e => setForm(f => ({ ...f, school: e.target.value }))} placeholder="Lincoln High" className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">University</span>
                    <input value={form.university ?? ''} onChange={e => setForm(f => ({ ...f, university: e.target.value }))} placeholder="MIT" className="mt-1 w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                  </label>
                </>
              )}

              {/* TAB 4 — Interests */}
              {editTab === 'interests' && (
                <>
                  <div>
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888] block mb-1.5">Hobbies</span>
                    <TagInput
                      values={form.hobbies ?? []}
                      onAdd={v => setForm(f => ({ ...f, hobbies: [...(f.hobbies ?? []), v] }))}
                      onRemove={i => setForm(f => ({ ...f, hobbies: (f.hobbies ?? []).filter((_, idx) => idx !== i) }))}
                      placeholder="Add a hobby…"
                      pillColor="indigo"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Music className="w-3 h-3 text-[#6B7280]" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Favorite Music</span>
                    </div>
                    <TagInput
                      values={form.favoriteMusic ?? []}
                      onAdd={v => setForm(f => ({ ...f, favoriteMusic: [...(f.favoriteMusic ?? []), v] }))}
                      onRemove={i => setForm(f => ({ ...f, favoriteMusic: (f.favoriteMusic ?? []).filter((_, idx) => idx !== i) }))}
                      placeholder="Add a genre or artist…"
                      pillColor="pink"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Dumbbell className="w-3 h-3 text-[#6B7280]" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Favorite Sports</span>
                    </div>
                    <TagInput
                      values={form.favoriteSports ?? []}
                      onAdd={v => setForm(f => ({ ...f, favoriteSports: [...(f.favoriteSports ?? []), v] }))}
                      onRemove={i => setForm(f => ({ ...f, favoriteSports: (f.favoriteSports ?? []).filter((_, idx) => idx !== i) }))}
                      placeholder="Add a sport…"
                      pillColor="green"
                    />
                  </div>
                  <label className="block">
                    <div className="flex items-center gap-1 mb-1.5">
                      <Trophy className="w-3 h-3 text-[#6B7280]" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#888888]">Favorite Team</span>
                    </div>
                    <input value={form.favoriteTeam ?? ''} onChange={e => setForm(f => ({ ...f, favoriteTeam: e.target.value }))} placeholder="e.g. Barcelona" className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors" />
                    {form.favoriteTeam && (
                      <span className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        ⚽ {form.favoriteTeam}
                      </span>
                    )}
                  </label>
                </>
              )}

              {/* TAB 5 — Privacy & Notifications */}
              {editTab === 'privacy' && (
                <div className="space-y-0.5">
                  <p className="text-xs text-[#6B7280] dark:text-[#555555] pb-2">Choose what other users can see on your profile. Changes save automatically.</p>
                  {([
                    { key: 'showBirthDate'    as const, label: 'Show birth date on profile' },
                    { key: 'showGender'       as const, label: 'Show gender on profile' },
                    { key: 'showRelationship' as const, label: 'Show relationship status on profile' },
                    { key: 'showEmail'        as const, label: 'Show email on profile' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6] dark:border-[#1E1E1E]">
                      <span className="text-sm text-[#1a1a1a] dark:text-[#F5F5F5]">{label}</span>
                      <Toggle value={(form[key] as boolean) ?? false} onChange={v => handlePrivacyToggle(key, v)} />
                    </div>
                  ))}

                  <div className="py-2"><div className="h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" /></div>

                  {([
                    { key: 'emailNotifications' as const, label: 'Receive email notifications' },
                    { key: 'newSigninAlerts'    as const, label: 'New sign-in alerts' },
                    { key: 'storageWarnings'    as const, label: 'Storage warnings' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6] dark:border-[#1E1E1E] last:border-0">
                      <span className="text-sm text-[#1a1a1a] dark:text-[#F5F5F5]">{label}</span>
                      <Toggle value={(form[key] as boolean) ?? true} onChange={v => handlePrivacyToggle(key, v)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0 space-y-2">
              {updateMutation.isError && (
                <p className="text-xs text-red-500">Failed to save profile. Please try again.</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 text-sm rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA] transition-colors shrink-0"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending || usernameStatus === 'taken' || usernameStatus === 'checking'}
                  className="flex-1 py-2 text-sm font-medium rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white disabled:opacity-60 transition-colors"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Followers / Following modal */}
      {followListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111111] rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0">
              <div className="flex gap-1 bg-[#F3F4F6] dark:bg-[#1E1E1E] rounded-xl p-1">
                {(['followers', 'following'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setFollowListModal({ tab }); setFollowListSearch(''); }}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                      followListModal.tab === tab
                        ? 'bg-white dark:bg-[#2A2A2A] text-[#0A0A0A] dark:text-[#F5F5F5] shadow-sm'
                        : 'text-[#6B7280] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setFollowListModal(null); setFollowListSearch(''); }}
                className="p-2 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0">
              <input
                value={followListSearch}
                onChange={e => setFollowListSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#F8F8F8] dark:bg-[#0A0A0A] px-3 py-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 px-3 py-2">
              {filteredModalUsers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <Users className="w-8 h-8 text-[#AAAAAA]" />
                  <p className="text-sm text-[#6B7280] dark:text-[#888888]">
                    {followListSearch
                      ? 'No users found'
                      : followListModal.tab === 'followers'
                        ? 'No followers yet'
                        : 'Not following anyone'}
                  </p>
                </div>
              ) : (
                filteredModalUsers.map(u => {
                  const isFollowingU = modalFollowMap[u.id] !== undefined ? modalFollowMap[u.id] : u.isFollowing;
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors">
                      <Link
                        to={`/profile/${u.id}`}
                        onClick={() => setFollowListModal(null)}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <AvatarCircle user={u} size={40} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{u.displayName}</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#888888] truncate">@{u.username}</p>
                        </div>
                      </Link>
                      {authUser && authUser.id !== u.id && (
                        <button
                          onClick={() => modalFollowMutation.mutate(u.id)}
                          disabled={modalFollowMutation.isPending && modalFollowMutation.variables === u.id}
                          className={`group shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            isFollowingU
                              ? 'border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#888888] hover:border-red-300 hover:text-red-500 dark:hover:border-red-800 dark:hover:text-red-400'
                              : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
                          }`}
                        >
                          {isFollowingU ? (
                            <>
                              <span className="group-hover:hidden">Following</span>
                              <span className="hidden group-hover:inline">Unfollow</span>
                            </>
                          ) : 'Follow'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
