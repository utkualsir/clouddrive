import { useState, useRef } from 'react';
import { ChevronRight, ChevronDown, Folder as FolderIcon, Lock } from 'lucide-react';
import { foldersApi } from '@/api/folders';
import { Folder } from '@/types';

export interface DragItem {
  type: 'file' | 'folder';
  id: string;
  name: string;
}

interface FolderNodeProps {
  folder: Folder;
  depth: number;
  currentFolderId: string | null;
  onNavigate: (folderId: string, folderName: string) => void;
  draggingItem: DragItem | null;
  onDropToFolder: (targetFolderId: string, targetFolderName: string) => void;
}

function FolderNode({ folder, depth, currentFolderId, onNavigate, draggingItem, onDropToFolder }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<Folder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const isActive = currentFolderId === folder.id;
  const canDrop = draggingItem !== null && draggingItem.id !== folder.id;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (depth >= 3) return; // Max depth 4 levels (0-indexed depth 3 = 4th level)
    if (!expanded && children === null) {
      setLoading(true);
      try {
        const res = await foldersApi.getAll(folder.id);
        setChildren(res.data ?? []);
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(v => !v);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrop) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.stopPropagation();
    dragCounter.current++;
    if (canDrop) setIsDragOver(true);
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
    if (canDrop) onDropToFolder(folder.id, folder.name);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 rounded-lg cursor-pointer text-[11px] transition-all select-none
          ${isActive
            ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 text-[#4F46E5] dark:text-[#6366f1] font-medium'
            : 'text-[#374151] dark:text-[#888888] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] hover:text-[#111827] dark:hover:text-[#F5F5F5]'}
          ${isDragOver ? 'ring-1 ring-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 !text-[#4F46E5]' : ''}
        `}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '6px' }}
        onClick={() => onNavigate(folder.id, folder.name)}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-folder-drop="true"
        data-folder-id={folder.id}
        data-folder-name={folder.name}
      >
        <button
          onClick={handleToggle}
          className="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          style={{ visibility: depth < 3 ? 'visible' : 'hidden' }}
        >
          {loading ? (
            <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          ) : expanded ? (
            <ChevronDown className="w-2.5 h-2.5" strokeWidth={2.5} />
          ) : (
            <ChevronRight className="w-2.5 h-2.5" strokeWidth={2.5} />
          )}
        </button>
        {folder.isEncrypted
          ? <Lock className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: folder.color }} />
          : <FolderIcon className="w-3 h-3 shrink-0" strokeWidth={1.5} style={{ color: folder.color }} />
        }
        <span className="truncate flex-1 leading-none">{folder.name}</span>
      </div>

      {expanded && children && (
        <div>
          {children.map(child => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              currentFolderId={currentFolderId}
              onNavigate={onNavigate}
              draggingItem={draggingItem}
              onDropToFolder={onDropToFolder}
            />
          ))}
          {children.length === 0 && (
            <p
              className="py-0.5 text-[10px] text-[#9CA3AF] dark:text-[#555555] italic"
              style={{ paddingLeft: `${8 + (depth + 1) * 14 + 4}px` }}
            >
              Empty
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface FolderTreeProps {
  currentFolderId: string | null;
  onNavigate: (folderId: string, folderName: string) => void;
  draggingItem: DragItem | null;
  onDropToFolder: (targetFolderId: string, targetFolderName: string) => void;
  refreshKey?: number;
}

export default function FolderTree({ currentFolderId, onNavigate, draggingItem, onDropToFolder, refreshKey }: FolderTreeProps) {
  const [open, setOpen] = useState(false);
  const [rootFolders, setRootFolders] = useState<Folder[] | null>(null);
  const [loading, setLoading] = useState(false);
  // refreshKey change resets loaded state so next open re-fetches
  const prevRefreshKey = useRef(refreshKey);
  if (prevRefreshKey.current !== refreshKey) {
    prevRefreshKey.current = refreshKey;
    setRootFolders(null);
  }

  const handleToggle = async () => {
    if (!open && rootFolders === null) {
      setLoading(true);
      try {
        const res = await foldersApi.getAll();
        setRootFolders(res.data ?? []);
      } catch {
        setRootFolders([]);
      } finally {
        setLoading(false);
      }
    }
    setOpen(v => !v);
  };

  return (
    <div className="pt-2">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 mb-0.5 py-0.5 rounded hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors group"
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#555555]">
          Folders
        </p>
        {loading ? (
          <div className="w-3 h-3 border border-[#6B7280] border-t-transparent rounded-full animate-spin" />
        ) : open ? (
          <ChevronDown className="w-3 h-3 text-[#6B7280] dark:text-[#555555]" strokeWidth={2} />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#6B7280] dark:text-[#555555]" strokeWidth={2} />
        )}
      </button>

      {open && rootFolders && (
        <div className="px-1">
          {rootFolders.length === 0 ? (
            <p className="px-3 py-1 text-[11px] text-[#9CA3AF] dark:text-[#555555]">No folders yet</p>
          ) : (
            rootFolders.map(folder => (
              <FolderNode
                key={folder.id}
                folder={folder}
                depth={0}
                currentFolderId={currentFolderId}
                onNavigate={onNavigate}
                draggingItem={draggingItem}
                onDropToFolder={onDropToFolder}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
