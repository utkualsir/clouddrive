import { useState, useEffect } from 'react';
import { X, Download, Trash2, RotateCcw, GitBranch, Loader2 } from 'lucide-react';
import { File, FileVersionsData } from '@/types';
import { filesApi } from '@/api/files';
import { formatFileSize, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface VersionHistoryPanelProps {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VersionHistoryPanel({ file, open, onClose, onSuccess }: VersionHistoryPanelProps) {
  const [data, setData] = useState<FileVersionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !open) { setData(null); return; }
    setLoading(true);
    filesApi.getVersions(file.id)
      .then(r => { if (r.success && r.data) setData(r.data); })
      .catch(() => toast.error('Failed to load versions'))
      .finally(() => setLoading(false));
  }, [file, open]);

  const handleDelete = async (versionId: string) => {
    if (!file) return;
    setActionId(versionId);
    try {
      await filesApi.deleteVersion(file.id, versionId);
      toast.success('Version deleted');
      const r = await filesApi.getVersions(file.id);
      if (r.success && r.data) setData(r.data);
      onSuccess();
    } catch {
      toast.error('Failed to delete version');
    } finally {
      setActionId(null);
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!file) return;
    setActionId(versionId);
    try {
      await filesApi.restoreVersion(file.id, versionId);
      toast.success('Version restored');
      const r = await filesApi.getVersions(file.id);
      if (r.success && r.data) setData(r.data);
      onSuccess();
    } catch {
      toast.error('Failed to restore version');
    } finally {
      setActionId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-80 bg-white dark:bg-[#141414] border-l border-[#E5E5E5] dark:border-[#2A2A2A] shadow-2xl flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E5E5E5] dark:border-[#2A2A2A] shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#4F46E5]" strokeWidth={1.5} />
            <span className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Version History</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[#AAAAAA] hover:text-[#6B6B6B] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* File name */}
        {file && (
          <div className="px-4 py-2.5 border-b border-[#F0F0F0] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#0D0D0D]">
            <p className="text-xs text-[#6B6B6B] dark:text-[#888888] truncate">{file.name}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 text-[#4F46E5] animate-spin" />
            </div>
          ) : !data ? null : (
            <div className="p-4 space-y-2">
              {/* Current version */}
              <div className="rounded-lg border border-[#4F46E5]/30 bg-[#EEF2FF]/50 dark:bg-[#1e1b4b]/20 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#4F46E5]">Version {data.currentVersion} (current)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4F46E5] text-white font-medium">current</span>
                </div>
                <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{formatFileSize(file?.size ?? '0')}</p>
                <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{file?.updatedAt ? formatDate(file.updatedAt) : ''}</p>
                <button
                  onClick={() => file && filesApi.downloadVersion(file.id, 'current')}
                  className="mt-2 flex items-center gap-1 text-[11px] text-[#4F46E5] hover:underline"
                >
                  <Download className="w-3 h-3" strokeWidth={1.5} /> Download current
                </button>
              </div>

              {/* Old versions */}
              {data.versions.length === 0 ? (
                <p className="text-xs text-[#AAAAAA] dark:text-[#444444] text-center py-6">No previous versions</p>
              ) : (
                data.versions.map(ver => (
                  <div key={ver.id} className="rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] p-3 bg-white dark:bg-[#1E1E1E]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">Version {ver.versionNumber}</span>
                    </div>
                    <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{formatFileSize(ver.size)}</p>
                    <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{formatDate(ver.createdAt)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => file && filesApi.downloadVersion(file.id, ver.id)}
                        disabled={actionId === ver.id}
                        className="flex items-center gap-1 text-[11px] text-[#6B6B6B] dark:text-[#888888] hover:text-[#4F46E5] transition-colors"
                      >
                        <Download className="w-3 h-3" strokeWidth={1.5} /> Download
                      </button>
                      <button
                        onClick={() => handleRestore(ver.id)}
                        disabled={actionId === ver.id}
                        className="flex items-center gap-1 text-[11px] text-[#6B6B6B] dark:text-[#888888] hover:text-[#4F46E5] transition-colors"
                      >
                        {actionId === ver.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" strokeWidth={1.5} />}
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(ver.id)}
                        disabled={actionId === ver.id}
                        className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-500 transition-colors ml-auto"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
