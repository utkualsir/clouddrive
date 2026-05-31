import { useEffect } from 'react';
import { Download, Trash2, Star, X, CheckSquare } from 'lucide-react';
import { filesApi } from '@/api/files';
import toast from 'react-hot-toast';

interface BulkBarProps {
  selectedIds: string[];
  selectedFolderIds: string[];
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onSuccess: () => void;
}

export default function BulkBar({ selectedIds, selectedFolderIds, totalCount, onSelectAll, onClear, onSuccess }: BulkBarProps) {
  const total = selectedIds.length + selectedFolderIds.length;

  // Escape key to clear selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && total > 0) onClear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClear]);

  if (total === 0) return null;

  const handleZip = async () => {
    if (selectedIds.length === 0) { toast.error('No files selected for ZIP (folders not supported)'); return; }
    try {
      toast.loading('Preparing ZIP…', { id: 'zip' });
      await filesApi.bulkZip(selectedIds);
      toast.success('Downloading!', { id: 'zip' });
    } catch {
      toast.error('ZIP download failed', { id: 'zip' });
    }
  };

  const handleStar = async () => {
    try {
      await filesApi.bulkStar(selectedIds, selectedFolderIds);
      toast.success(`Starred ${total} item${total > 1 ? 's' : ''}`);
      onSuccess();
      onClear();
    } catch {
      toast.error('Failed to star items');
    }
  };

  const handleTrash = async () => {
    try {
      await filesApi.bulkTrash(selectedIds, selectedFolderIds);
      const ids = [...selectedIds];
      const folderIds = [...selectedFolderIds];
      onSuccess();
      onClear();

      toast.success(
        (t) => (
          <div className="flex items-center gap-3">
            <span>{total} item{total > 1 ? 's' : ''} moved to trash</span>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                await filesApi.bulkRestore(ids, folderIds);
                onSuccess();
                toast.success('Restored!');
              }}
              className="text-xs font-semibold text-[#4F46E5] hover:underline"
            >
              Undo
            </button>
          </div>
        ),
        { duration: 5000 }
      );
    } catch {
      toast.error('Failed to trash items');
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
      <div className="flex items-center gap-1 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-2 py-1.5">
        {/* Count badge */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 mr-1 border-r border-[#E5E5E5] dark:border-[#2A2A2A]">
          <span className="text-xs font-semibold text-[#4F46E5]">{total}</span>
          <span className="text-xs text-[#6B6B6B] dark:text-[#888888]">selected</span>
        </div>

        {/* Select all */}
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] rounded-lg transition-colors"
        >
          <CheckSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
          All ({totalCount})
        </button>

        {/* ZIP - files only */}
        {selectedIds.length > 0 && (
          <button
            onClick={handleZip}
            title="Download files as ZIP"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">ZIP</span>
          </button>
        )}

        <button
          onClick={handleStar}
          title="Star selected"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] rounded-lg transition-colors"
        >
          <Star className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Star</span>
        </button>

        <button
          onClick={handleTrash}
          title="Move to trash"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Trash</span>
        </button>

        {/* Clear */}
        <div className="border-l border-[#E5E5E5] dark:border-[#2A2A2A] ml-1 pl-1">
          <button
            onClick={onClear}
            title="Clear selection (Esc)"
            className="p-1.5 text-[#AAAAAA] dark:text-[#444444] hover:text-[#6B6B6B] dark:hover:text-[#888888] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
