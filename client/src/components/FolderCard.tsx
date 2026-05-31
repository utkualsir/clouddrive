import React, { useState, useRef, useEffect } from 'react';
import { Folder as FolderIcon, Lock, Star, MoreHorizontal, Pencil, Trash2, Palette, StarOff, Share2 } from 'lucide-react';
import { Folder } from '@/types';
import { formatDate } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface FolderCardProps {
  folder: Folder;
  viewMode: 'grid' | 'list';
  index?: number;
  onOpen: (folder: Folder) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onStar: (folder: Folder) => void;
  onColorChange: (folder: Folder) => void;
  onLock: (folder: Folder) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onShare?: (folder: Folder) => void;
  readOnly?: boolean;
  onDragStart?: (folder: Folder) => void;
  onDragEnd?: () => void;
  onDropItem?: (targetFolder: Folder) => void;
  onTouchDrop?: (folderId: string, folderName: string) => void;
  isDragging?: boolean;
}

function FolderCard({ folder, viewMode, index = 0, onOpen, onRename, onDelete, onStar, onColorChange, onLock, selected = false, onSelect, onShare, readOnly = false, onDragStart, onDragEnd, onDropItem, onTouchDrop, isDragging = false }: FolderCardProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const touchTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

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

  // Drag handlers (this folder being dragged)
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-100px;left:0;background:#4F46E5;color:white;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:500;pointer-events:none;';
    ghost.textContent = `📁 ${folder.name}`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 60, 20);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
    onDragStart?.(folder);
  };

  // Drop target handlers (things dropped onto this folder)
  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropItem) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.stopPropagation();
    dragCounter.current++;
    if (onDropItem) setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragOver(false); }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    onDropItem?.(folder);
  };

  // Touch drag (long press 500ms → full touch drag)
  const isTouchDragging = useRef(false);
  const touchGhostEl = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isTouchDragging.current = false;
    touchTimer.current = window.setTimeout(() => {
      isTouchDragging.current = true;
      navigator.vibrate?.(50);
      onDragStart?.(folder);
      const g = document.createElement('div');
      g.style.cssText = `position:fixed;top:${touch.clientY - 20}px;left:${touch.clientX - 50}px;background:#4F46E5;color:white;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:500;pointer-events:none;z-index:9999;opacity:0.9;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
      g.textContent = `📁 ${folder.name}`;
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
      if (fid && fid !== folder.id) onTouchDrop?.(fid, fname ?? 'Folder');
    }
    onDragEnd?.();
  };

  const menuItems = [
    ...(!readOnly ? [{ icon: Pencil, label: t('folder.rename'), action: () => onRename(folder) }] : []),
    { icon: folder.isStarred ? StarOff : Star, label: folder.isStarred ? t('folder.unstar') : t('folder.star'), action: () => onStar(folder) },
    ...(!readOnly ? [{ icon: Palette, label: t('folder.changeColor'), action: () => onColorChange(folder) }] : []),
    ...(!readOnly ? [{ icon: Lock, label: t('folder.lock'), action: () => onLock(folder), disabled: folder.isEncrypted }] : []),
    ...(onShare ? [{ icon: Share2, label: t('folder.share'), action: () => onShare(folder) }] : []),
    ...(!readOnly ? [{ icon: Trash2, label: t('folder.delete'), action: () => onDelete(folder), danger: true }] : []),
  ];

  const delay = `${index * 40}ms`;

  if (viewMode === 'list') {
    return (
      <>
        <div
          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer group rounded-lg transition-colors duration-150 animate-fade-up ${selected ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/20' : 'hover:bg-[#F8F8F8] dark:hover:bg-[#141414]'} ${isDragging ? 'opacity-40' : ''} ${isDragOver ? 'ring-1 ring-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/20' : ''}`}
          style={{ animationDelay: delay, animationFillMode: 'both' }}
          draggable={!!onDragStart}
          onDragStart={handleDragStart}
          onDragEnd={() => { setIsDragOver(false); onDragEnd?.(); }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDoubleClick={() => onOpen(folder)}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          data-folder-drop={onDropItem ? 'true' : undefined}
          data-folder-id={folder.id}
          data-folder-name={folder.name}
        >
          {onSelect && (
            <button
              onClick={e => { e.stopPropagation(); onSelect(folder.id); }}
              className={`shrink-0 w-4 h-4 rounded border transition-colors ${selected ? 'bg-[#4F46E5] border-[#4F46E5]' : 'border-[#D1D5DB] dark:border-[#3A3A3A] opacity-0 group-hover:opacity-100'}`}
            >
              {selected && <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="relative shrink-0">
              {folder.isEncrypted
                ? <Lock className="w-4 h-4" style={{ color: folder.color }} strokeWidth={1.5} />
                : <FolderIcon className="w-4 h-4" style={{ color: folder.color }} strokeWidth={1.5} />
              }
            </div>
            <span className="text-sm text-[#0A0A0A] dark:text-[#F5F5F5] truncate font-medium">{folder.name}</span>
          </div>
          {folder.isStarred && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B] shrink-0" strokeWidth={0} />}
          <span className="text-xs text-[#AAAAAA] dark:text-[#444444] shrink-0 hidden sm:block w-28 text-right">{formatDate(folder.updatedAt)}</span>
          <button
            onClick={handleMenuBtn}
            className="p-1 rounded-md text-[#AAAAAA] dark:text-[#444444] opacity-0 group-hover:opacity-100 hover:text-[#6B6B6B] dark:hover:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-all duration-150"
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
        className={`relative group p-4 bg-white dark:bg-[#1E1E1E] border rounded-lg cursor-pointer transition-all duration-200 animate-fade-up ${selected ? 'border-[#4F46E5] dark:border-[#6366f1] ring-1 ring-[#4F46E5]/30' : 'border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] dark:hover:border-[#6366f1] hover:scale-[1.01]'} ${isDragging ? 'opacity-40 scale-95' : ''} ${isDragOver ? '!border-[#4F46E5] ring-2 ring-[#4F46E5]/30 bg-[#EEF2FF] dark:bg-[#1e1b4b]/10' : ''}`}
        style={{ animationDelay: delay, animationFillMode: 'both' }}
        draggable={!!onDragStart}
        onDragStart={handleDragStart}
        onDragEnd={() => { setIsDragOver(false); onDragEnd?.(); }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDoubleClick={() => onOpen(folder)}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-folder-drop={onDropItem ? 'true' : undefined}
        data-folder-id={folder.id}
        data-folder-name={folder.name}
      >
        {onSelect && (
          <button
            onClick={e => { e.stopPropagation(); onSelect(folder.id); }}
            className={`absolute top-2 left-2 z-10 w-4 h-4 rounded border transition-all ${selected ? 'opacity-100 bg-[#4F46E5] border-[#4F46E5]' : 'opacity-0 group-hover:opacity-100 border-[#D1D5DB] dark:border-[#3A3A3A] bg-white dark:bg-[#1E1E1E]'}`}
          >
            {selected && <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>
        )}
        <div className="flex items-start justify-between mb-3">
          <div className="relative">
            {folder.isEncrypted
              ? <Lock className="w-5 h-5" style={{ color: folder.color }} strokeWidth={1.5} />
              : <FolderIcon className="w-5 h-5" style={{ color: folder.color }} strokeWidth={1.5} />
            }
          </div>
          <div className="flex items-center gap-1.5">
            {folder.isStarred && <Star className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]" strokeWidth={0} />}
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: folder.color }} />
          </div>
        </div>
        <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate mb-0.5">{folder.name}</p>
        <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{formatDate(folder.updatedAt)}</p>

        <button
          onClick={handleMenuBtn}
          className="absolute top-3 right-3 p-1 rounded-md opacity-0 group-hover:opacity-100 text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] dark:hover:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#252525] transition-all duration-150"
        >
          <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {menuOpen && <ContextMenu ref={menuRef} pos={menuPos} items={menuItems} onClose={() => setMenuOpen(false)} />}
    </>
  );
}

interface MenuItem { icon: React.ElementType; label: string; action: () => void; danger?: boolean; disabled?: boolean; }

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
        {items.map(({ icon: Icon, label, action, danger, disabled }) => (
          <button
            key={label}
            disabled={disabled}
            onClick={() => { action(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed ${
              danger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'
                : 'text-[#0A0A0A] dark:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]'
            }`}
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

export default React.memo(FolderCard);
