import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, File as FileIcon, Folder as FolderIcon, MessageSquare, Search, Users } from 'lucide-react';
import { searchApi } from '@/api/search';
import { File, Folder, ForumThread, SuggestedUser } from '@/types';
import { FileTypeTag } from '@/components/FileIcon';
import { formatDate, formatFileSize } from '@/lib/utils';

type TabId = 'all' | 'files' | 'folders' | 'users' | 'forum';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'All', icon: Search },
  { id: 'files', label: 'Files', icon: FileIcon },
  { id: 'folders', label: 'Folders', icon: FolderIcon },
  { id: 'users', label: 'People', icon: Users },
  { id: 'forum', label: 'Forum', icon: MessageSquare },
];

function FileRow({ file, onClick }: { file: File; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors text-left"
    >
      <FileTypeTag mimeType={file.mimeType} size="sm" />
      <span className="flex-1 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate font-medium">{file.name}</span>
      <span className="text-xs text-[#AAAAAA] dark:text-[#444444] shrink-0 hidden sm:block">{formatFileSize(file.size)}</span>
      <span className="text-xs text-[#AAAAAA] dark:text-[#444444] shrink-0 hidden md:block">{formatDate(file.updatedAt)}</span>
    </button>
  );
}

function FolderRow({ folder, onClick }: { folder: Folder; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors text-left"
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (folder.color ?? '#6366f1') + '28' }}>
        <FolderIcon className="w-4 h-4" style={{ color: folder.color ?? '#6366f1' }} strokeWidth={1.5} />
      </div>
      <span className="flex-1 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate font-medium">{folder.name}</span>
      <span className="text-xs text-[#AAAAAA] dark:text-[#444444] shrink-0 hidden md:block">{formatDate(folder.updatedAt)}</span>
    </button>
  );
}

function UserRow({ user, onClick }: { user: SuggestedUser; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors text-left"
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
        style={{ backgroundColor: user.avatarColor }}
      >
        {user.displayName.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5] font-medium truncate">{user.displayName}</p>
        <p className="text-xs text-[#AAAAAA] dark:text-[#444444] truncate">@{user.username}{user.occupation ? ` · ${user.occupation}` : ''}</p>
      </div>
    </button>
  );
}

function ThreadRow({ thread, onClick }: { thread: ForumThread; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors text-left"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: (thread.category?.color ?? '#6366f1') + '20' }}
      >
        {thread.category?.icon ?? '💬'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5] font-medium truncate">{thread.title}</p>
        <p className="text-xs text-[#AAAAAA] dark:text-[#444444] truncate">
          {thread.category?.name} · {thread.author?.displayName} · {thread.postCount} replies
        </p>
      </div>
    </button>
  );
}

function SectionBlock({ title, children, onSeeAll }: { title: string; children: React.ReactNode; onSeeAll?: () => void }) {
  return (
    <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0] dark:border-[#1E1E1E]">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#555555]">{title}</p>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-[11px] text-[#4F46E5] hover:underline">See all</button>
        )}
      </div>
      <div className="py-1">{children}</div>
    </div>
  );
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [activeTab, setActiveTab] = useState<TabId>((searchParams.get('tab') as TabId) ?? 'all');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (activeTab !== 'all') params.tab = activeTab;
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, activeTab]);

  const searchType = activeTab === 'all' ? 'all' : activeTab;

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, searchType],
    queryFn: () => searchApi.search(debouncedQuery, searchType),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30_000,
  });

  const results = data?.data;
  const files: File[] = results?.files ?? [];
  const folders: Folder[] = results?.folders ?? [];
  const users: SuggestedUser[] = (results?.users as SuggestedUser[]) ?? [];
  const threads: ForumThread[] = results?.threads ?? [];

  const hasResults = files.length > 0 || folders.length > 0 || users.length > 0 || threads.length > 0;

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Header */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A] px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
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
              placeholder="Search files, folders, people, forum…"
              className="flex-1 bg-transparent text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] focus:outline-none"
            />
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-3xl mx-auto flex gap-1 mt-2.5 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#4F46E5] text-white'
                    : 'text-[#6B7280] dark:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E]'
                }`}
              >
                <Icon className="w-3 h-3" strokeWidth={1.5} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {!debouncedQuery ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Search className="w-10 h-10 text-[#E5E5E5] dark:text-[#2A2A2A]" strokeWidth={1} />
            <p className="text-sm text-[#6B7280] dark:text-[#555555]">Type to search across your drive</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-4 space-y-2">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="h-8 bg-[#F0F0F0] dark:bg-[#252525] rounded animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Search className="w-10 h-10 text-[#E5E5E5] dark:text-[#2A2A2A]" strokeWidth={1} />
            <p className="text-sm text-[#6B7280] dark:text-[#555555]">No results for "{debouncedQuery}"</p>
          </div>
        ) : (
          <>
            {/* Files */}
            {(activeTab === 'all' || activeTab === 'files') && files.length > 0 && (
              <SectionBlock
                title="Files"
                onSeeAll={activeTab === 'all' && files.length >= 3 ? () => setActiveTab('files') : undefined}
              >
                {(activeTab === 'all' ? files.slice(0, 3) : files).map(f => (
                  <FileRow key={f.id} file={f} onClick={() => navigate(`/drive?q=${f.name}`)} />
                ))}
              </SectionBlock>
            )}

            {/* Folders */}
            {(activeTab === 'all' || activeTab === 'folders') && folders.length > 0 && (
              <SectionBlock
                title="Folders"
                onSeeAll={activeTab === 'all' && folders.length >= 3 ? () => setActiveTab('folders') : undefined}
              >
                {(activeTab === 'all' ? folders.slice(0, 3) : folders).map(f => (
                  <FolderRow key={f.id} folder={f} onClick={() => navigate('/drive')} />
                ))}
              </SectionBlock>
            )}

            {/* People */}
            {(activeTab === 'all' || activeTab === 'users') && users.length > 0 && (
              <SectionBlock
                title="People"
                onSeeAll={activeTab === 'all' && users.length >= 3 ? () => setActiveTab('users') : undefined}
              >
                {(activeTab === 'all' ? users.slice(0, 3) : users).map(u => (
                  <UserRow key={u.id} user={u} onClick={() => navigate(`/profile/${u.username}`)} />
                ))}
              </SectionBlock>
            )}

            {/* Forum */}
            {(activeTab === 'all' || activeTab === 'forum') && threads.length > 0 && (
              <SectionBlock
                title="Forum"
                onSeeAll={activeTab === 'all' && threads.length >= 3 ? () => setActiveTab('forum') : undefined}
              >
                {(activeTab === 'all' ? threads.slice(0, 3) : threads).map(t => (
                  <ThreadRow key={t.id} thread={t} onClick={() => navigate(`/forum/thread/${t.id}`)} />
                ))}
              </SectionBlock>
            )}
          </>
        )}
      </div>
    </div>
  );
}
