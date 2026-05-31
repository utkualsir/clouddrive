import { useState, useCallback, useMemo, useEffect, useRef, RefObject } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Bell, ChevronDown, ChevronRight, FileText, FolderPlus, HelpCircle, RefreshCw, Trash2, Upload, SlidersHorizontal, X as XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { foldersApi } from '@/api/folders';
import { filesApi } from '@/api/files';
import { tagsApi } from '@/api/tags';
import { SharedFolderEntry } from '@/api/payments';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingOverlay from '@/components/OnboardingOverlay';
import { Folder, File, ViewMode, SortField, SortOrder, BreadcrumbItem, FileVisibility } from '@/types';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Breadcrumb from '@/components/layout/Breadcrumb';
import FolderCard from '@/components/FolderCard';
import FileCard from '@/components/FileCard';
import BulkBar from '@/components/BulkBar';
import UploadModal from '@/components/modals/UploadModal';
import FilePreviewModal from '@/components/modals/FilePreviewModal';
import FolderModal from '@/components/modals/FolderModal';
import LockFolderModal from '@/components/modals/LockFolderModal';
import ShareModal from '@/components/modals/ShareModal';
import ShareFolderModal from '@/components/modals/ShareFolderModal';
import VersionHistoryPanel from '@/components/VersionHistoryPanel';
import LiveCursors from '@/components/LiveCursors';
import InstallBanner from '@/components/InstallBanner';
import TemplateModal from '@/components/modals/TemplateModal';
import { DragItem } from '@/components/layout/FolderTree';
import { getPermission, requestPermission } from '@/services/notificationService';
import { Skeleton } from '@/components/ui/skeleton';
import { getFileCategory } from '@/lib/utils';
import { useWebSocket } from '@/contexts/WebSocketContext';

type DriveView = 'drive' | 'recent' | 'starred' | 'trash';

export default function DrivePage() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(() => user?.onboardingCompleted === false);
  const queryClient = useQueryClient();
  const [view, setView] = useState<DriveView>('drive');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: t('nav.myDrive') }]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('viewMode') as ViewMode) ?? 'grid');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  // Drag & drop
  const [draggingItem, setDraggingItem] = useState<DragItem | null>(null);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  // New item dropdown
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);

  // Template modal
  const [templateOpen, setTemplateOpen] = useState(false);

  // Desktop notification permission banner
  const [showNotifBanner, setShowNotifBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem('notif-never') === '1') return false;
    if (sessionStorage.getItem('notif-dismissed') === '1') return false;
    const perm = getPermission();
    return perm === 'default';
  });

  // URL-driven filter state
  const searchQuery = searchParams.get('q') ?? '';
  const typeFilter = (searchParams.get('type') ?? 'all') as 'all' | 'images' | 'documents' | 'videos' | 'audio' | 'archives';
  const dateFilter = (searchParams.get('date') ?? 'all') as 'all' | '7days' | '30days' | 'year';
  const sortBy = searchParams.get('sort') ?? '';
  const visibilityFilter = (searchParams.get('vis') ?? 'all') as 'all' | FileVisibility;

  const setSearchQuery = (q: string) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (q) p.set('q', q); else p.delete('q'); return p; }, { replace: true });
  const setTypeFilter = (t: string) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (t && t !== 'all') p.set('type', t); else p.delete('type'); return p; }, { replace: true });
  const setDateFilter = (d: string) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (d && d !== 'all') p.set('date', d); else p.delete('date'); return p; }, { replace: true });
  const setSortBy = (s: string) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (s) p.set('sort', s); else p.delete('sort'); return p; }, { replace: true });
  const setVisibilityFilter = (v: string) => setSearchParams(prev => { const p = new URLSearchParams(prev); if (v && v !== 'all') p.set('vis', v); else p.delete('vis'); return p; }, { replace: true });
  const clearFilters = () => setSearchParams({}, { replace: true });

  const hasActiveFilters = typeFilter !== 'all' || dateFilter !== 'all' || !!sortBy || !!searchQuery || visibilityFilter !== 'all';

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);

  const { lastEvent, sendMessage, folderViewers, liveCursors } = useWebSocket();
  const gridAreaRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const cursorThrottleRef = useRef<number | null>(null);
  const [tickerText, setTickerText] = useState<string | null>(null);
  const tickerTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!lastEvent) return;
    const who = lastEvent.displayName ?? 'Someone';
    let text = '';
    if (lastEvent.type === 'file_uploaded') text = `${who} uploaded ${lastEvent.fileName ?? 'a file'}`;
    else if (lastEvent.type === 'file_deleted') text = `${who} deleted ${lastEvent.fileName ?? 'a file'}`;
    else if (lastEvent.type === 'file_downloaded') text = `${who} downloaded ${lastEvent.fileName ?? 'a file'}`;
    else if (lastEvent.type === 'folder_created') text = `${who} created folder "${lastEvent.folderName ?? ''}"`;
    else if (lastEvent.type === 'user_online') text = `${who} came online`;
    if (!text) return;
    setTickerText(text);
    if (tickerTimer.current) clearTimeout(tickerTimer.current);
    tickerTimer.current = window.setTimeout(() => setTickerText(null), 4000);
  }, [lastEvent]);

  // Live cursors: join/leave folder presence
  useEffect(() => {
    if (view !== 'drive') return;
    const folderId = currentFolderId ?? 'root';
    sendMessage({ type: 'join_folder', folderId });
    return () => {
      sendMessage({ type: 'leave_folder', folderId });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentFolderId]);

  // Keyboard shortcut event listeners
  useEffect(() => {
    const handleOpenUpload = () => setUploadOpen(true);
    const handleFocusSearch = () => {
      const el = document.querySelector<HTMLInputElement>('[data-shortcut="search-input"]');
      el?.focus();
    };
    const handleNavigate = (e: Event) => {
      const { view } = (e as CustomEvent<{ view: string }>).detail;
      setView(view as DriveView);
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: null, name: 'My Drive' }]);
    };
    const handleDeleteSelected = () => {
      if (selectedIds.length === 0 && selectedFolderIds.length === 0) return;
      const total = selectedIds.length + selectedFolderIds.length;
      if (confirm(`Delete ${total} selected item${total !== 1 ? 's' : ''}?`)) {
        selectedIds.forEach(id => trashFileMutation.mutate(id));
        selectedFolderIds.forEach(id => trashFolderMutation.mutate(id));
        setSelectedIds([]);
        setSelectedFolderIds([]);
      }
    };
    const handleNewFolder = () => setNewFolderOpen(true);
    const handleSearch = (e: Event) => {
      const { q } = (e as CustomEvent<{ q: string }>).detail;
      setSearchQuery(q);
    };

    window.addEventListener('clouddrive:open-upload', handleOpenUpload);
    window.addEventListener('clouddrive:focus-search', handleFocusSearch);
    window.addEventListener('clouddrive:navigate', handleNavigate);
    window.addEventListener('clouddrive:delete-selected', handleDeleteSelected);
    window.addEventListener('clouddrive:new-folder', handleNewFolder);
    window.addEventListener('clouddrive:search', handleSearch);
    return () => {
      window.removeEventListener('clouddrive:open-upload', handleOpenUpload);
      window.removeEventListener('clouddrive:focus-search', handleFocusSearch);
      window.removeEventListener('clouddrive:navigate', handleNavigate);
      window.removeEventListener('clouddrive:delete-selected', handleDeleteSelected);
      window.removeEventListener('clouddrive:new-folder', handleNewFolder);
      window.removeEventListener('clouddrive:search', handleSearch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, selectedFolderIds]);

  // Modals
  const [sharedFolderInfo, setSharedFolderInfo] = useState<SharedFolderEntry | null>(null);

  const openSharedFolder = useCallback((entry: SharedFolderEntry) => {
    setSharedFolderInfo(entry);
    setCurrentFolderId(entry.folder.id);
    setBreadcrumbs([{ id: null, name: t('nav.myDrive') }, { id: entry.folder.id, name: entry.folder.name }]);
    setView('drive');
    setSidebarOpen(false);
    setSelectedIds([]);
  }, []);

  const isViewOnly = sharedFolderInfo?.permission === 'VIEW';
  const canUpload = !sharedFolderInfo || sharedFolderInfo.permission !== 'VIEW';
  const canManage = !sharedFolderInfo || sharedFolderInfo.permission === 'MANAGE';

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [lockFolder, setLockFolder] = useState<Folder | null>(null);
  const [unlockFolder, setUnlockFolder] = useState<Folder | null>(null);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [shareFolderTarget, setShareFolderTarget] = useState<Folder | null>(null);
  const [versionHistoryFile, setVersionHistoryFile] = useState<File | null>(null);

  const foldersQuery = useQuery({ queryKey: ['folders', currentFolderId], queryFn: () => foldersApi.getAll(currentFolderId ?? undefined), enabled: view === 'drive' });
  const filesQuery = useQuery({
    queryKey: ['files', currentFolderId, searchQuery, typeFilter, dateFilter, sortBy, activeTagId, visibilityFilter],
    queryFn: () => filesApi.getAll(currentFolderId ?? undefined, {
      q: searchQuery || undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      dateRange: dateFilter !== 'all' ? dateFilter : undefined,
      sortBy: sortBy || undefined,
      tagId: activeTagId || undefined,
      visibility: visibilityFilter !== 'all' ? visibilityFilter : undefined,
    }),
    enabled: view === 'drive',
  });
  const allTagsQuery = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.getAll(), enabled: !!user });
  const allTags = allTagsQuery.data?.data ?? [];
  const recentQuery = useQuery({ queryKey: ['files-recent'], queryFn: () => filesApi.getRecent(), enabled: view === 'recent' });
  const starredFoldersQuery = useQuery({ queryKey: ['folders-starred'], queryFn: () => foldersApi.getStarred(), enabled: view === 'starred' });
  const starredFilesQuery = useQuery({ queryKey: ['files-starred'], queryFn: () => filesApi.getStarred(), enabled: view === 'starred' });
  const trashQuery = useQuery({ queryKey: ['trash'], queryFn: () => filesApi.getTrash(), enabled: view === 'trash' });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['files-recent'] });
    queryClient.invalidateQueries({ queryKey: ['folders-starred'] });
    queryClient.invalidateQueries({ queryKey: ['files-starred'] });
    queryClient.invalidateQueries({ queryKey: ['trash'] });
    queryClient.invalidateQueries({ queryKey: ['storage-stats'] });
    queryClient.invalidateQueries({ queryKey: ['activity'] });
  }, [queryClient]);

  const createFolderMutation = useMutation({ mutationFn: ({ name, color }: { name: string; color: string }) => foldersApi.create({ name, color, parentId: currentFolderId ?? undefined }), onSuccess: () => { toast.success('Folder created'); invalidateAll(); }, onError: () => toast.error('Failed to create folder') });
  const renameFolderMutation = useMutation({ mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) => foldersApi.update(id, { name, color }), onSuccess: () => { toast.success('Folder renamed'); invalidateAll(); }, onError: () => toast.error('Failed to rename folder') });
  const starFolderMutation = useMutation({ mutationFn: (id: string) => foldersApi.star(id), onSuccess: () => invalidateAll() });
  const trashFolderMutation = useMutation({ mutationFn: (id: string) => foldersApi.trash(id), onSuccess: () => { toast.success('Moved to trash'); invalidateAll(); } });
  const deletePermFolderMutation = useMutation({ mutationFn: (id: string) => foldersApi.deletePermanent(id), onSuccess: () => { toast.success('Folder deleted'); invalidateAll(); } });
  const lockFolderMutation = useMutation({ mutationFn: ({ id, password }: { id: string; password: string }) => foldersApi.lock(id, password), onSuccess: () => { toast.success('Folder locked'); invalidateAll(); }, onError: () => toast.error('Failed to lock folder') });
  const unlockFolderMutation = useMutation({ mutationFn: ({ id, password }: { id: string; password: string }) => foldersApi.unlock(id, password), onSuccess: (_, { id }) => { toast.success('Folder unlocked'); openFolder(id); invalidateAll(); }, onError: () => toast.error('Incorrect password') });
  const starFileMutation = useMutation({ mutationFn: (id: string) => filesApi.star(id), onSuccess: () => invalidateAll() });
  const trashFileMutation = useMutation({ mutationFn: (id: string) => filesApi.trash(id), onSuccess: () => { toast.success('Moved to trash'); invalidateAll(); } });
  const deletePermFileMutation = useMutation({ mutationFn: (id: string) => filesApi.deletePermanent(id), onSuccess: () => { toast.success('File deleted'); invalidateAll(); } });
  const addTagMutation = useMutation({ mutationFn: ({ fileId, tagId }: { fileId: string; tagId: string }) => tagsApi.addToFile(fileId, tagId), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['files'] }); queryClient.invalidateQueries({ queryKey: ['tags'] }); } });
  const removeTagMutation = useMutation({ mutationFn: ({ fileId, tagId }: { fileId: string; tagId: string }) => tagsApi.removeFromFile(fileId, tagId), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['files'] }); queryClient.invalidateQueries({ queryKey: ['tags'] }); } });
  const changeVisibilityMutation = useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: FileVisibility }) => filesApi.updateVisibility(id, visibility),
    onSuccess: () => { toast.success('Visibility updated'); invalidateAll(); },
    onError: () => toast.error('Failed to update visibility'),
  });

  const moveFileMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string }) => filesApi.move(id, folderId),
    onSuccess: () => { setTreeRefreshKey(k => k + 1); invalidateAll(); },
    onError: () => toast.error('Failed to move item'),
  });
  const moveFolderMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string }) => foldersApi.move(id, parentId),
    onSuccess: () => { setTreeRefreshKey(k => k + 1); invalidateAll(); },
    onError: () => toast.error('Failed to move item'),
  });

  const handleDropToFolder = useCallback((targetFolderId: string, targetFolderName: string) => {
    setDraggingItem(prev => {
      if (!prev) return null;
      if (prev.type === 'file') {
        moveFileMutation.mutate({ id: prev.id, folderId: targetFolderId });
        toast.success(`Moved "${prev.name}" to ${targetFolderName}`);
      } else {
        if (prev.id === targetFolderId) return null;
        moveFolderMutation.mutate({ id: prev.id, parentId: targetFolderId });
        toast.success(`Moved "${prev.name}" to ${targetFolderName}`);
      }
      return null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close new-item dropdown on outside click
  useEffect(() => {
    if (!newDropdownOpen) return;
    const fn = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) setNewDropdownOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [newDropdownOpen]);

  const openFolder = useCallback((folderId: string) => {
    const folder = foldersQuery.data?.data?.find(f => f.id === folderId);
    setCurrentFolderId(folderId);
    setBreadcrumbs(prev => [...prev, { id: folderId, name: folder?.name ?? 'Folder' }]);
    setView('drive');
  }, [foldersQuery.data]);

  const navigateBreadcrumb = useCallback((id: string | null) => {
    setCurrentFolderId(id);
    if (id === null) {
      setBreadcrumbs([{ id: null, name: t('nav.myDrive') }]);
      setSharedFolderInfo(null);
    } else {
      setBreadcrumbs(prev => { const idx = prev.findIndex(b => b.id === id); return idx >= 0 ? prev.slice(0, idx + 1) : prev; });
    }
  }, []);

  const handleDownload = useCallback((file: File) => {
    const token = localStorage.getItem('token');
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
    fetch(`${apiBase}/api/files/${file.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.originalName; a.click(); URL.revokeObjectURL(url); invalidateAll(); })
      .catch(() => toast.error('Download failed'));
  }, [invalidateAll]);

  const handleFolderOpen = useCallback((folder: Folder) => {
    if (folder.isEncrypted) setUnlockFolder(folder);
    else openFolder(folder.id);
  }, [openFolder]);

  // Drag-drop
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.types.includes('Files')) setIsDragOver(true); };
  const handleDragLeave = () => { dragCounter.current--; if (dragCounter.current === 0) setIsDragOver(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current = 0; setIsDragOver(false); if (e.dataTransfer.files.length > 0) setUploadOpen(true); };

  // Bulk selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);
  const toggleSelectFolder = useCallback((id: string) => {
    setSelectedFolderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const viewTitle = view === 'recent' ? t('nav.recent') : view === 'starred' ? t('nav.starred') : view === 'trash' ? t('nav.trash') : t('nav.myDrive');

  const applySort = <T extends { name: string; createdAt: string; size?: string; updatedAt: string }>(items: T[], field: SortField, order: SortOrder): T[] =>
    [...items].sort((a, b) => {
      let cmp = 0;
      if (field === 'name') cmp = a.name.localeCompare(b.name);
      else if (field === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (field === 'size') cmp = parseInt(a.size ?? '0') - parseInt(b.size ?? '0');
      return order === 'asc' ? cmp : -cmp;
    });

  const handleSortChange = (field: SortField) => {
    if (field === sortField) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  useEffect(() => { localStorage.setItem('viewMode', viewMode); }, [viewMode]);
  useEffect(() => { setSelectedIds([]); setSelectedFolderIds([]); }, [view, currentFolderId]);

  const [todayExpanded, setTodayExpanded] = useState(true);

  const todayFiles = useMemo(() => {
    if (view !== 'drive') return [];
    const today = new Date().toISOString().slice(0, 10);
    return (filesQuery.data?.data ?? []).filter(f => f.createdAt.slice(0, 10) === today);
  }, [view, filesQuery.data]);

  const currentFolders: Folder[] = useMemo(() => {
    const raw = view === 'drive' ? (foldersQuery.data?.data ?? []) : view === 'starred' ? (starredFoldersQuery.data?.data ?? []) : view === 'trash' ? (trashQuery.data?.data?.folders ?? []) : [];
    const filtered = searchQuery ? raw.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : raw;
    return applySort(filtered, sortField, sortOrder);
  }, [view, foldersQuery.data, starredFoldersQuery.data, trashQuery.data, searchQuery, sortField, sortOrder]);

  const currentFiles: File[] = useMemo(() => {
    // For drive view, server already applied filters; for other views, still client-side
    if (view === 'drive') return filesQuery.data?.data ?? [];
    const raw = view === 'recent' ? (recentQuery.data?.data ?? []) : view === 'starred' ? (starredFilesQuery.data?.data ?? []) : view === 'trash' ? (trashQuery.data?.data?.files ?? []) : [];
    let filtered = searchQuery ? raw.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : raw;
    if (typeFilter !== 'all') filtered = filtered.filter(f => getFileCategory(f.mimeType) === (typeFilter === 'images' ? 'image' : typeFilter === 'documents' ? 'pdf' : typeFilter));
    return applySort(filtered, sortField, sortOrder);
  }, [view, filesQuery.data, recentQuery.data, starredFilesQuery.data, trashQuery.data, searchQuery, typeFilter, sortField, sortOrder]);

  const isLoading = view === 'drive' ? (foldersQuery.isLoading || filesQuery.isLoading) : view === 'recent' ? recentQuery.isLoading : view === 'starred' ? (starredFoldersQuery.isLoading || starredFilesQuery.isLoading) : trashQuery.isLoading;
  const isEmpty = !isLoading && currentFolders.length === 0 && currentFiles.length === 0;

  return (
    <div className="flex h-screen bg-white dark:bg-[#0A0A0A] overflow-hidden" onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
      {/* Drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center backdrop-blur-sm bg-white/60 dark:bg-black/60">
          <div className="border-2 border-dashed border-[#4F46E5] rounded-2xl w-[90%] h-[85%] flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center">
              <Upload className="w-6 h-6 text-[#4F46E5]" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-[#4F46E5]">{t('drive.dropToUpload')}</p>
              <p className="text-xs text-[#6B6B6B] dark:text-[#888888] mt-1">{t('drive.dropFilesHere')}</p>
            </div>
          </div>
        </div>
      )}

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto transition-transform duration-200`}>
        <Sidebar
          currentView={view}
          onViewChange={v => { setView(v as DriveView); setCurrentFolderId(null); setBreadcrumbs([{ id: null, name: t('nav.myDrive') }]); setSidebarOpen(false); setSelectedIds([]); setSharedFolderInfo(null); setActiveTagId(null); }}
          onSharedFolderOpen={openSharedFolder}
          onTagFilter={tagId => { setActiveTagId(tagId); setView('drive'); setCurrentFolderId(null); setBreadcrumbs([{ id: null, name: t('nav.myDrive') }]); setSidebarOpen(false); }}
          activeTagId={activeTagId}
          currentFolderId={currentFolderId}
          onNavigateToFolder={(folderId, folderName) => {
            setCurrentFolderId(folderId);
            setBreadcrumbs([{ id: null, name: t('nav.myDrive') }, { id: folderId, name: folderName }]);
            setView('drive');
            setSidebarOpen(false);
            setSelectedIds([]);
            setSharedFolderInfo(null);
          }}
          draggingItem={draggingItem}
          onDropToFolder={handleDropToFolder}
          folderTreeRefreshKey={treeRefreshKey}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <InstallBanner />

        {/* Desktop notification permission banner */}
        {showNotifBanner && (
          <div className="flex items-center gap-3 px-4 py-2 bg-[#4F46E5] text-white text-xs shrink-0">
            <Bell className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            <span className="flex-1">Enable desktop notifications to stay updated</span>
            <button
              onClick={async () => {
                const perm = await requestPermission();
                if (perm === 'granted') toast.success('Desktop notifications enabled!');
                setShowNotifBanner(false);
              }}
              className="px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 font-medium transition-colors shrink-0"
            >
              Enable
            </button>
            <button
              onClick={() => { sessionStorage.setItem('notif-dismissed', '1'); setShowNotifBanner(false); }}
              className="px-2 py-1 rounded-md hover:bg-white/20 transition-colors shrink-0"
            >
              Maybe later
            </button>
            <button
              onClick={() => { localStorage.setItem('notif-never', '1'); setShowNotifBanner(false); }}
              className="px-2 py-1 rounded-md hover:bg-white/20 transition-colors shrink-0"
            >
              Never
            </button>
            <button
              onClick={() => { sessionStorage.setItem('notif-dismissed', '1'); setShowNotifBanner(false); }}
              className="p-1 rounded-md hover:bg-white/20 transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}

        <Header viewMode={viewMode} onViewModeChange={setViewMode} sortField={sortField} sortOrder={sortOrder} onSortChange={handleSortChange} searchQuery={searchQuery} onSearchChange={setSearchQuery} onUploadClick={() => { if (canUpload) setUploadOpen(true); }} onMenuClick={() => setSidebarOpen(true)} title={viewTitle} uploadDisabled={isViewOnly} />

        {view === 'drive' && breadcrumbs.length > 1 && <Breadcrumb items={breadcrumbs} onNavigate={navigateBreadcrumb} />}
        {view === 'drive' && activeTagId && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[#F5F5FF] dark:bg-[#1e1b4b]/20 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: allTags.find(t => t.id === activeTagId)?.color ?? '#6366f1' }} />
            <span className="text-[11px] text-[#6B6B6B] dark:text-[#888888]">
              Filtered by tag: <span className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{allTags.find(t => t.id === activeTagId)?.name}</span>
            </span>
            <button onClick={() => setActiveTagId(null)} className="ml-auto p-0.5 rounded text-[#6B7280] dark:text-[#555555] hover:text-[#374151] dark:hover:text-[#888888]">
              <XIcon className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        )}
        {view === 'drive' && sharedFolderInfo && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[#F5F5FF] dark:bg-[#1e1b4b]/20 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0"
              style={{ backgroundColor: sharedFolderInfo.owner.avatarColor }}
            >
              {sharedFolderInfo.owner.displayName[0]?.toUpperCase()}
            </div>
            <span className="text-[11px] text-[#6B6B6B] dark:text-[#888888]">
              {t('drive.sharedBy')} <span className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{sharedFolderInfo.owner.displayName}</span>
            </span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                color: isViewOnly ? '#6B6B6B' : sharedFolderInfo.permission === 'UPLOAD' ? '#3b82f6' : '#4F46E5',
                backgroundColor: (isViewOnly ? '#6B6B6B' : sharedFolderInfo.permission === 'UPLOAD' ? '#3b82f6' : '#4F46E5') + '20',
              }}
            >
              {sharedFolderInfo.permission}
            </span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          {view === 'drive' && canManage && (
            <div className="relative" ref={newDropdownRef}>
              <button
                onClick={() => setNewDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                New
                <ChevronDown className="w-3 h-3 ml-0.5" strokeWidth={1.5} />
              </button>
              {newDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                  <button
                    onClick={() => { setNewFolderOpen(true); setNewDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#0A0A0A] dark:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    New Folder
                  </button>
                  <button
                    onClick={() => { setTemplateOpen(true); setNewDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#0A0A0A] dark:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E] transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
                    From Template
                  </button>
                </div>
              )}
            </div>
          )}
          {view === 'trash' && (currentFolders.length > 0 || currentFiles.length > 0) && (
            <button className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium ml-auto border border-red-200 dark:border-red-900/40 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors" onClick={() => { if (confirm('Permanently delete all trash?')) { currentFiles.forEach(f => deletePermFileMutation.mutate(f.id)); currentFolders.forEach(f => deletePermFolderMutation.mutate(f.id)); } }}>
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              {t('drive.emptyTrashAll')}
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 h-7 px-2 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                <XIcon className="w-3 h-3" strokeWidth={1.5} />
                {t('common.clear')}
              </button>
            )}
            <button
              onClick={() => setFilterOpen(v => !v)}
              className={`flex items-center gap-1.5 h-7 px-2.5 text-xs rounded-lg border transition-colors ${filterOpen || hasActiveFilters ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414]'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">{t('common.filter')}</span>
            </button>
            <button onClick={invalidateAll} className="p-1.5 rounded-md text-[#6B7280] dark:text-[#555555] hover:text-[#6B6B6B] dark:hover:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors">
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {(filterOpen || hasActiveFilters) && (
          <div className="px-4 py-2.5 border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#0D0D0D] overflow-x-auto">
            <div className="flex items-center gap-4 min-w-max">
              {/* Type */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#555555] uppercase tracking-widest">{t('common.type')}</span>
                {(['all','images','documents','videos','audio','archives'] as const).map(typ => (
                  <button key={typ} onClick={() => setTypeFilter(typ)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors capitalize ${typeFilter === typ ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'}`}>
                    {typ === 'all' ? t('common.all') : typ}
                  </button>
                ))}
              </div>
              {/* Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#555555] uppercase tracking-widest">{t('common.date')}</span>
                {([['all', t('common.anyTime')],['7days', t('common.last7Days')],['30days', t('common.last30Days')],['year', t('common.thisYear')]] as const).map(([v,l]) => (
                  <button key={v} onClick={() => setDateFilter(v)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${dateFilter === v ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#555555] uppercase tracking-widest">{t('common.sort')}</span>
                {([['newest', t('common.sortNewest')],['oldest', t('common.sortOldest')],['name_asc', t('common.sortNameAZ')],['name_desc', t('common.sortNameZA')],['largest', t('common.sortLargest')],['smallest', t('common.sortSmallest')]] as const).map(([v,l]) => (
                  <button key={v} onClick={() => setSortBy(sortBy === v ? '' : v)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${sortBy === v ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Visibility */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#555555] uppercase tracking-widest">Visibility</span>
                {(['all','PUBLIC','FRIENDS','PRIVATE'] as const).map(v => (
                  <button key={v} onClick={() => setVisibilityFilter(v)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${visibilityFilter === v ? 'border-[#4F46E5] text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] dark:text-[#888888] hover:border-[#AAAAAA]'}`}>
                    {v === 'all' ? 'All' : v.charAt(0) + v.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main
          ref={gridAreaRef}
          className="flex-1 overflow-y-auto p-4 relative"
          onMouseMove={e => {
            if (view !== 'drive') return;
            if (cursorThrottleRef.current) return;
            cursorThrottleRef.current = window.setTimeout(() => {
              cursorThrottleRef.current = null;
            }, 50);
            const rect = gridAreaRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            sendMessage({ type: 'cursor_move', folderId: currentFolderId ?? 'root', x, y });
          }}
        >
          {/* Live cursors overlay */}
          {view === 'drive' && (
            <LiveCursors cursors={liveCursors} viewers={folderViewers} containerRef={gridAreaRef} />
          )}
          {/* Today's Uploads */}
          {view === 'drive' && !isLoading && todayFiles.length > 0 && (
            <div className="mb-5 border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl overflow-hidden">
              <button
                onClick={() => setTodayExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#FAFAFA] dark:bg-[#0D0D0D] hover:bg-[#F5F5F5] dark:hover:bg-[#111111] transition-colors"
              >
                {todayExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#555555]" strokeWidth={1.5} /> : <ChevronRight className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#555555]" strokeWidth={1.5} />}
                <span className="text-[11px] font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] uppercase tracking-widest">Today's Uploads</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#4F46E5] text-white font-medium">{todayFiles.length}</span>
              </button>
              {todayExpanded && (
                <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-thin scrollbar-thumb-[#E5E5E5] dark:scrollbar-thumb-[#2A2A2A]">
                  {todayFiles.map((file, i) => (
                    <div key={file.id} className="shrink-0 w-36">
                      <FileCard
                        file={file}
                        viewMode="grid"
                        index={i}
                        onPreview={f => setPreviewFile(f)}
                        onDownload={handleDownload}
                        onDelete={f => trashFileMutation.mutate(f.id)}
                        onStar={f => starFileMutation.mutate(f.id)}
                        onShare={f => setShareFile(f)}
                        onVersionHistory={f => setVersionHistoryFile(f)}
                        onVisibilityChange={(f, v) => changeVisibilityMutation.mutate({ id: f.id, visibility: v })}
                        readOnly={!canManage}
                        onDragStart={f => setDraggingItem({ type: 'file', id: f.id, name: f.name })}
                        onDragEnd={() => setDraggingItem(null)}
                        isDragging={draggingItem?.id === file.id}
                        onTouchDrop={handleDropToFolder}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : 'space-y-1'}>
              {[...Array(12)].map((_, i) => <Skeleton key={i} className={viewMode === 'grid' ? 'h-28 rounded-lg' : 'h-10 rounded-lg'} />)}
            </div>
          ) : isEmpty ? (
            <EmptyState view={view} onUpload={() => setUploadOpen(true)} onNewFolder={() => setNewFolderOpen(true)} searchQuery={searchQuery} typeFilter={typeFilter} />
          ) : (
            <div className="space-y-5">
              {currentFolders.length > 0 && (
                <section>
                  {(currentFiles.length > 0 || view !== 'drive') && <h2 className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280] dark:text-[#555555] mb-2.5">{t('drive.folders')}</h2>}
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : 'space-y-0.5'}>
                    {currentFolders.map((folder, i) => (
                      <FolderCard key={folder.id} folder={folder} viewMode={viewMode} index={i} onOpen={handleFolderOpen} onRename={f => setRenamingFolder(f)} onDelete={f => trashFolderMutation.mutate(f.id)} onStar={f => starFolderMutation.mutate(f.id)} onColorChange={f => setRenamingFolder(f)} onLock={f => setLockFolder(f)} selected={selectedFolderIds.includes(folder.id)} onSelect={view === 'drive' ? toggleSelectFolder : undefined} onShare={canManage && !sharedFolderInfo ? f => setShareFolderTarget(f) : undefined} readOnly={!canManage} onDragStart={f => setDraggingItem({ type: 'folder', id: f.id, name: f.name })} onDragEnd={() => setDraggingItem(null)} onDropItem={f => handleDropToFolder(f.id, f.name)} isDragging={draggingItem?.id === folder.id} onTouchDrop={handleDropToFolder} />
                    ))}
                  </div>
                </section>
              )}
              {currentFiles.length > 0 && (
                <section>
                  {currentFolders.length > 0 && <h2 className="text-[10px] font-medium uppercase tracking-widest text-[#6B7280] dark:text-[#555555] mb-2.5">{t('drive.files')}</h2>}
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : 'space-y-0.5'}>
                    {currentFiles.map((file, i) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        viewMode={viewMode}
                        index={currentFolders.length + i}
                        selected={selectedIds.includes(file.id)}
                        onSelect={toggleSelect}
                        onPreview={f => setPreviewFile(f)}
                        onDownload={handleDownload}
                        onDelete={view === 'trash' ? f => deletePermFileMutation.mutate(f.id) : f => trashFileMutation.mutate(f.id)}
                        onStar={f => starFileMutation.mutate(f.id)}
                        onShare={f => setShareFile(f)}
                        onVersionHistory={f => setVersionHistoryFile(f)}
                        onVisibilityChange={(f, v) => changeVisibilityMutation.mutate({ id: f.id, visibility: v })}
                        readOnly={!canManage}
                        onTagFilter={tagId => setActiveTagId(tagId)}
                        allTags={allTags}
                        onTagAdd={(fileId, tagId) => addTagMutation.mutate({ fileId, tagId })}
                        onTagRemove={(fileId, tagId) => removeTagMutation.mutate({ fileId, tagId })}
                        onDragStart={f => setDraggingItem({ type: 'file', id: f.id, name: f.name })}
                        onDragEnd={() => setDraggingItem(null)}
                        isDragging={draggingItem?.id === file.id}
                        onTouchDrop={handleDropToFolder}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Bulk bar */}
      <BulkBar
        selectedIds={selectedIds}
        selectedFolderIds={selectedFolderIds}
        totalCount={currentFiles.length + currentFolders.length}
        onSelectAll={() => { setSelectedIds(currentFiles.map(f => f.id)); setSelectedFolderIds(currentFolders.map(f => f.id)); }}
        onClear={() => { setSelectedIds([]); setSelectedFolderIds([]); }}
        onSuccess={invalidateAll}
      />

      {/* Keyboard shortcuts hint */}
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
        title="Keyboard shortcuts (?)"
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] p-2 rounded-full bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:text-[#4F46E5] dark:hover:text-[#6366f1] hover:border-[#4F46E5] shadow-sm transition-all"
      >
        <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
      </button>

      {/* Live activity ticker */}
      {tickerText && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A0A0A] dark:bg-[#F5F5F5] text-white dark:text-[#0A0A0A] text-xs font-medium shadow-lg animate-fade-up pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 animate-pulse" />
          {tickerText}
        </div>
      )}

      {/* Modals */}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} folderId={currentFolderId} onSuccess={invalidateAll} />
      <FilePreviewModal file={previewFile} open={!!previewFile} onClose={() => setPreviewFile(null)} onDownload={handleDownload} />
      <FolderModal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} onSubmit={async (name, color) => { await createFolderMutation.mutateAsync({ name, color }); }} title="New folder" />
      {renamingFolder && (
        <FolderModal open={!!renamingFolder} onClose={() => setRenamingFolder(null)} onSubmit={async (name, color) => { await renameFolderMutation.mutateAsync({ id: renamingFolder.id, name, color }); }} initialName={renamingFolder.name} initialColor={renamingFolder.color} title="Rename folder" />
      )}
      <LockFolderModal folder={lockFolder} mode="lock" open={!!lockFolder} onClose={() => setLockFolder(null)} onSubmit={async (password) => { if (lockFolder) await lockFolderMutation.mutateAsync({ id: lockFolder.id, password }); }} />
      <LockFolderModal folder={unlockFolder} mode="unlock" open={!!unlockFolder} onClose={() => setUnlockFolder(null)} onSubmit={async (password) => { if (unlockFolder) await unlockFolderMutation.mutateAsync({ id: unlockFolder.id, password }); }} />
      <ShareModal file={shareFile} open={!!shareFile} onClose={() => setShareFile(null)} onUpdate={invalidateAll} />
      <ShareFolderModal folder={shareFolderTarget} open={!!shareFolderTarget} onClose={() => setShareFolderTarget(null)} />
      <VersionHistoryPanel
        file={versionHistoryFile}
        open={!!versionHistoryFile}
        onClose={() => setVersionHistoryFile(null)}
        onSuccess={invalidateAll}
      />
      <TemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        currentFolderId={currentFolderId}
        currentFolders={currentFolders}
        onSuccess={invalidateAll}
      />

      {/* Onboarding overlay */}
      {showOnboarding && user && (
        <OnboardingOverlay
          displayName={user.displayName}
          onComplete={() => {
            setShowOnboarding(false);
            updateUser({ ...user, onboardingCompleted: true });
            queryClient.invalidateQueries({ queryKey: ['auth-me'] });
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ view, onUpload, onNewFolder, searchQuery, typeFilter }: { view: DriveView; onUpload: () => void; onNewFolder: () => void; searchQuery: string; typeFilter: string }) {
  const { t } = useTranslation();

  if (searchQuery || typeFilter !== 'all') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-[#E5E5E5] dark:text-[#2A2A2A]">
          <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="1.5" />
          <path d="M35 35l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M18 24h12M24 18v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{t('drive.noResults')}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#555555]">
          {searchQuery ? `No files matching "${searchQuery}"` : t('drive.noFiles')}
        </p>
      </div>
    );
  }

  const configs: Record<DriveView, { title: string; desc: string }> = {
    drive:   { title: t('drive.emptyDrive'),   desc: t('drive.emptyDriveDesc') },
    recent:  { title: t('drive.emptyRecent'),  desc: t('drive.emptyRecentDesc') },
    starred: { title: t('drive.emptyStarred'), desc: t('drive.emptyStarredDesc') },
    trash:   { title: t('drive.emptyTrash'),   desc: t('drive.emptyTrashDesc') },
  };
  const { title, desc } = configs[view];

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-[#E5E5E5] dark:text-[#2A2A2A]">
        <rect x="8" y="20" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 28h48" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="8" width="24" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="44" cy="44" r="8" fill="currentColor" fillOpacity="0.4" />
        <path d="M41 44h6M44 41v6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="text-center">
        <h3 className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{title}</h3>
        <p className="text-xs text-[#6B7280] dark:text-[#555555] mt-1 max-w-[220px]">{desc}</p>
      </div>
      {view === 'drive' && (
        <div className="flex gap-2 mt-1">
          <button onClick={onUpload} className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors">
            <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />{t('common.upload')}
          </button>
          <button onClick={onNewFolder} className="flex items-center gap-1.5 h-8 px-4 text-xs font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors">
            <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.5} />{t('drive.newFolder')}
          </button>
        </div>
      )}
    </div>
  );
}
