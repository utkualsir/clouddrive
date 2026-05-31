import React, { useState, useRef, useEffect } from 'react';
import { Star, MoreHorizontal, Download, Trash2, StarOff, Eye, Share2, GitBranch, Pencil, History, Tag as TagIcon, Globe, Users, Lock, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { File, Tag, FileVisibility } from '@/types';
import { FileTypeTag } from './FileIcon';
import { formatDate, formatFileSize } from '@/lib/utils';
import { filesApi } from '@/api/files';
import { useTranslation } from 'react-i18next';

const VISIBILITY_ICONS: Record<FileVisibility, typeof Globe> = { PUBLIC: Globe, FRIENDS: Users, PRIVATE: Lock };
const VISIBILITY_LABELS: Record<FileVisibility, string> = { PUBLIC: 'Public', FRIENDS: 'Friends', PRIVATE: 'Private' };
const VISIBILITY_CYCLE: Record<FileVisibility, FileVisibility> = { PRIVATE: 'FRIENDS', FRIENDS: 'PUBLIC', PUBLIC: 'PRIVATE' };

const EDITABLE_EXTS = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'html', 'css', 'js']);

interface FileCardProps {
  file: File;
  viewMode: 'grid' | 'list';
  index?: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onPreview: (file: File) => void;
  onDownload: (file: File) => void;
  onDelete: (file: File) => void;
  onStar: (file: File) => void;
  onShare: (file: File) => void;
  onVersionHistory?: (file: File) => void;
  onVisibilityChange?: (file: File, v: FileVisibility) => void;
  readOnly?: boolean;
  onTagFilter?: (tagId: string | null) => void;
  allTags?: Tag[];
  onTagAdd?: (fileId: string, tagId: string) => void;
  onTagRemove?: (fileId: string, tagId: string) => void;
  onDragStart?: (file: File) => void;
  onDragEnd?: () => void;
  onTouchDrop?: (folderId: string, folderName: string) => void;
  isDragging?: boolean;
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function Thumbnail({ file }: { file: File }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { rootMargin: '120px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!IMAGE_MIMES.includes(file.mimeType) || !file.thumbnailPath || error) return null;

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {inView && (
        <img
          src={`${filesApi.getThumbnailUrl(file.id)}${token ? `?token=${token}` : ''}`}
          alt={file.name}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

function FileCard({
  file, viewMode, index = 0, selected = false, onSelect,
  onPreview, onDownload, onDelete, onStar, onShare, onVersionHistory, onVisibilityChange, readOnly = false,
  onTagFilter, allTags, onTagAdd, onTagRemove,
  onDragStart, onDragEnd, onTouchDrop, isDragging = false,
}: FileCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerPos, setTagPickerPos] = useState({ x: 0, y: 0 });
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(!!file.isLiked);
  const [likeCount, setLikeCount] = useState(file.likeCount ?? 0);

  useEffect(() => {
    if (!tagPickerOpen) return;
    const fn = (e: MouseEvent) => { if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) setTagPickerOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [tagPickerOpen]);

  const touchTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isTouchDragging = useRef(false);
  const touchGhostEl = useRef<HTMLDivElement | null>(null);

  const handleFileDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-100px;left:0;background:#4F46E5;color:white;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:500;pointer-events:none;';
    ghost.textContent = `📄 ${file.name}`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 60, 20);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
    onDragStart?.(file);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isTouchDragging.current = false;
    touchTimer.current = window.setTimeout(() => {
      isTouchDragging.current = true;
      navigator.vibrate?.(50);
      onDragStart?.(file);
      const g = document.createElement('div');
      g.style.cssText = `position:fixed;top:${touch.clientY - 20}px;left:${touch.clientX - 50}px;background:#4F46E5;color:white;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:500;pointer-events:none;z-index:9999;opacity:0.9;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
      g.textContent = `📄 ${file.name}`;
      document.body.appendChild(g);
      touchGhostEl.current = g;
    }, 500);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (isTouchDragging.current) {
      e.preventDefault();
      if (touchGhostEl.current) {
        touchGhostEl.current.style.top = `${touch.clientY - 20}px`;
        touchGhostEl.current.style.left = `${touch.clientX - 50}px`;
      }
    } else if (touchTimer.current) {
      const dx = touch.clientX - (touchStartPos.current?.x ?? 0);
      const dy = touch.clientY - (touchStartPos.current?.y ?? 0);
      if (Math.sqrt(dx * dx + dy * dy) > 8) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimer.current) { clearTimeout(touchTimer.current); touchTimer.current = null; }
    if (!isTouchDragging.current) return;
    isTouchDragging.current = false;
    if (touchGhostEl.current) { document.body.removeChild(touchGhostEl.current); touchGhostEl.current = null; }
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropEl = el?.closest('[data-folder-drop]');
    if (dropEl) {
      const fid = dropEl.getAttribute('data-folder-id');
      const fname = dropEl.getAttribute('data-folder-name');
      if (fid) onTouchDrop?.(fid, fname ?? 'Folder');
    }
    onDragEnd?.();
  };

  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isEditable = EDITABLE_EXTS.has(fileExt);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const openMenu = (x: number, y: number) => { setMenuPos({ x, y }); setMenuOpen(true); };
  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); openMenu(e.clientX, e.clientY); };
  const handleMenuBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu(r.left, r.bottom + 4);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const visibility = (file.visibility ?? 'PRIVATE') as FileVisibility;
  const VisibilityIcon = VISIBILITY_ICONS[visibility];
  const nextVisibility = VISIBILITY_CYCLE[visibility];

  const menuItems = [
    { icon: Eye,                             label: t('file.preview'),  action: () => onPreview(file) },
    ...(isEditable ? [{ icon: Pencil,        label: t('file.edit'),     action: () => navigate(`/drive/edit/${file.id}`) }] : []),
    { icon: Download,                        label: t('file.download'), action: () => onDownload(file) },
    { icon: Share2,                          label: t('file.share'),    action: () => onShare(file) },
    { icon: file.isStarred ? StarOff : Star, label: file.isStarred ? t('file.unstar') : t('file.star'), action: () => onStar(file) },
    ...(onVersionHistory && (file.currentVersion ?? file.versionCount) > 1 ? [{ icon: History, label: t('file.versions'), action: () => onVersionHistory(file) }] : []),
    ...(allTags && allTags.length > 0 && (onTagAdd || onTagRemove) ? [{ icon: TagIcon, label: 'Add tag', action: () => { setTagPickerPos(menuPos); setTagPickerOpen(true); } }] : []),
    ...(!readOnly && onVisibilityChange ? [{ icon: VisibilityIcon, label: `Make ${VISIBILITY_LABELS[nextVisibility]}`, action: () => onVisibilityChange(file, nextVisibility) }] : []),
    ...(!readOnly ? [{ icon: Trash2, label: t('file.delete'), action: () => onDelete(file), danger: true }] : []),
  ];

  const delay = `${index * 40}ms`;
  const hasThumb = IMAGE_MIMES.includes(file.mimeType) && !!file.thumbnailPath;
  const isShared = !!file.shareToken;
  const hasVersions = file.versionCount > 1;

  if (viewMode === 'list') {
    return (
      <>
        <div
          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer group rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors duration-150 animate-fade-up ${selected ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : ''} ${isDragging ? 'opacity-40' : ''}`}
          style={{ animationDelay: delay, animationFillMode: 'both' }}
          draggable={!!onDragStart}
          onDragStart={handleFileDragStart}
          onDragEnd={() => onDragEnd?.()}
          onClick={() => onPreview(file)}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Checkbox */}
          {onSelect && (
            <button
              onClick={e => { e.stopPropagation(); onSelect(file.id); }}
              className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected ? 'bg-[#4F46E5] border-[#4F46E5]' : 'border-[#E5E5E5] dark:border-[#2A2A2A] opacity-0 group-hover:opacity-100'}`}
            >
              {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          )}

          {/* Thumbnail or icon */}
          {hasThumb ? (
            <div className="w-8 h-8 rounded overflow-hidden shrink-0 relative bg-[#F0F0F0] dark:bg-[#252525]">
              <Thumbnail file={file} />
            </div>
          ) : (
            <FileTypeTag mimeType={file.mimeType} size="sm" />
          )}

          <span className="flex-1 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate font-medium">{file.name}</span>

          <div className="flex items-center gap-2 shrink-0">
            {isShared && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5] font-medium">shared</span>}
            {hasVersions && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0F0F0] dark:bg-[#252525] text-[#6B6B6B] dark:text-[#888888] font-medium">v{file.versionCount}</span>}
            {file.isStarred && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" strokeWidth={0} />}
            <VisibilityIcon className="w-3 h-3 text-[#AAAAAA] dark:text-[#555555]" strokeWidth={1.5} aria-label={VISIBILITY_LABELS[visibility]} />
            <span className="hidden lg:flex items-center gap-3 text-[11px] text-[#AAAAAA] dark:text-[#555555]">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" strokeWidth={1.5} />{file.viewCount ?? 0}</span>
              <span className="flex items-center gap-1"><Download className="w-3 h-3" strokeWidth={1.5} />{file.downloadCount ?? 0}</span>
              <button onClick={handleLike} className={`flex items-center gap-1 transition-colors hover:text-red-400 ${liked ? 'text-red-400' : ''}`}>
                <Heart className={`w-3 h-3 ${liked ? 'fill-red-400 stroke-red-400' : ''}`} strokeWidth={1.5} />{likeCount}
              </button>
            </span>
            <span className="text-xs text-[#AAAAAA] dark:text-[#444444] hidden md:block w-16 text-right">{formatFileSize(file.size)}</span>
            <span className="text-xs text-[#AAAAAA] dark:text-[#444444] hidden sm:block w-28 text-right">{formatDate(file.updatedAt)}</span>
          </div>

          <button
            onClick={handleMenuBtn}
            className="p-1 rounded-md text-[#AAAAAA] dark:text-[#444444] opacity-0 group-hover:opacity-100 hover:text-[#6B6B6B] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-all"
          >
            <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        {menuOpen && <ContextMenu ref={menuRef} pos={menuPos} items={menuItems} onClose={() => setMenuOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <div
        className={`relative group p-4 bg-white dark:bg-[#1E1E1E] border rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.01] animate-fade-up ${
          selected
            ? 'border-[#4F46E5] dark:border-[#6366f1] ring-1 ring-[#4F46E5]/30'
            : 'border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] dark:hover:border-[#6366f1]'
        } ${hasThumb ? 'pb-[50%] min-h-[120px]' : ''} ${isDragging ? 'opacity-40 scale-95' : ''}`}
        style={{ animationDelay: delay, animationFillMode: 'both' }}
        draggable={!!onDragStart}
        onDragStart={handleFileDragStart}
        onDragEnd={() => onDragEnd?.()}
        onClick={() => onPreview(file)}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Thumbnail overlay */}
        {hasThumb && <Thumbnail file={file} />}

        {/* Checkbox — top left */}
        {onSelect && (
          <button
            onClick={e => { e.stopPropagation(); onSelect(file.id); }}
            className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border flex items-center justify-center transition-all ${selected ? 'bg-[#4F46E5] border-[#4F46E5] opacity-100' : 'border-white/80 bg-white/80 dark:border-[#2A2A2A]/80 dark:bg-[#1E1E1E]/80 opacity-0 group-hover:opacity-100'}`}
          >
            {selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        )}

        {!hasThumb && (
          <div className="flex items-start justify-between mb-3">
            <FileTypeTag mimeType={file.mimeType} />
            <div className="flex items-center gap-1.5">
              {isShared && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5] font-medium">shared</span>}
              {hasVersions && (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#F0F0F0] dark:bg-[#252525] text-[#6B6B6B] dark:text-[#888888] font-medium">
                  <GitBranch className="w-2.5 h-2.5" strokeWidth={1.5} />v{file.versionCount}
                </span>
              )}
              {file.isStarred && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" strokeWidth={0} />}
              <VisibilityIcon className="w-3 h-3 text-[#AAAAAA] dark:text-[#555555]" strokeWidth={1.5} aria-label={VISIBILITY_LABELS[visibility]} />
            </div>
          </div>
        )}

        {!hasThumb && (
          <>
            <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate mb-0.5">{file.name}</p>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{formatFileSize(file.size)}</p>
              <button
                onClick={handleLike}
                className={`flex items-center gap-0.5 text-[11px] transition-colors hover:text-red-400 ${liked ? 'text-red-400' : 'text-[#AAAAAA] dark:text-[#555555]'}`}
              >
                <Heart className={`w-3 h-3 ${liked ? 'fill-red-400 stroke-red-400' : ''}`} strokeWidth={1.5} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>
            </div>
            {file.tags && file.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {file.tags.slice(0, 2).map(ft => (
                  <span
                    key={ft.tagId}
                    onClick={e => { e.stopPropagation(); onTagFilter?.(ft.tagId); }}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: ft.tag.color + '28', color: ft.tag.color, border: `1px solid ${ft.tag.color}40` }}
                  >
                    {ft.tag.name}
                  </span>
                ))}
                {file.tags.length > 2 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#F0F0F0] dark:bg-[#252525] text-[#6B6B6B] dark:text-[#888888]">
                    +{file.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* Badges on thumbnail */}
        {hasThumb && (
          <div className="absolute bottom-2 left-2 right-2 z-10 flex items-end justify-between">
            <p className="text-xs font-medium text-white drop-shadow truncate">{file.name}</p>
            <div className="flex items-center gap-1">
              {isShared && <span className="text-[9px] px-1 py-0.5 rounded bg-black/60 text-white font-medium">shared</span>}
              {hasVersions && <span className="text-[9px] px-1 py-0.5 rounded bg-black/60 text-white font-medium">v{file.versionCount}</span>}
              <button
                onClick={handleLike}
                className={`flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-black/60 font-medium transition-colors ${liked ? 'text-red-400' : 'text-white'}`}
              >
                <Heart className={`w-2.5 h-2.5 ${liked ? 'fill-red-400 stroke-red-400' : ''}`} strokeWidth={1.5} />
                {likeCount > 0 && likeCount}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleMenuBtn}
          className="absolute top-2 right-2 z-10 p-1 rounded-md opacity-0 group-hover:opacity-100 text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] hover:bg-[#F0F0F0]/80 dark:hover:bg-[#252525]/80 transition-all"
        >
          <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {menuOpen && <ContextMenu ref={menuRef} pos={menuPos} items={menuItems} onClose={() => setMenuOpen(false)} />}
      {tagPickerOpen && allTags && (
        <div
          ref={tagPickerRef}
          className="fixed z-[150] min-w-[160px] bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg shadow-lg p-1"
          style={{ top: Math.min(tagPickerPos.y, window.innerHeight - 250), left: Math.min(tagPickerPos.x, window.innerWidth - 180) }}
        >
          <p className="px-2.5 py-1 text-[10px] font-semibold text-[#6B7280] dark:text-[#555555] uppercase tracking-wider">Tags</p>
          {allTags.map(tag => {
            const assigned = (file.tags ?? []).some(ft => ft.tagId === tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => { if (assigned) onTagRemove?.(file.id, tag.id); else onTagAdd?.(file.id, tag.id); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#0A0A0A] dark:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 text-left">{tag.name}</span>
                {assigned && <span className="text-[#4F46E5] dark:text-[#6366f1] text-[10px] font-bold">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

interface MenuItem { icon: React.ElementType; label: string; action: () => void; danger?: boolean; }

const ContextMenu = React.forwardRef<HTMLDivElement, { pos: { x: number; y: number }; items: MenuItem[]; onClose: () => void }>(
  ({ pos, items, onClose }, ref) => {
    const vH = window.innerHeight;
    const mH = items.length * 36 + 12;
    const top = pos.y + mH > vH ? pos.y - mH : pos.y;
    return (
      <div
        ref={ref}
        className="fixed z-[100] min-w-[168px] bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)] p-1 animate-modal-in"
        style={{ top, left: Math.min(pos.x, window.innerWidth - 188) }}
      >
        {items.map(({ icon: Icon, label, action, danger }) => (
          <button
            key={label}
            onClick={() => { action(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10' : 'text-[#0A0A0A] dark:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]'}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>
    );
  }
);
ContextMenu.displayName = 'ContextMenu';

export default React.memo(FileCard);
