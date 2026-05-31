import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileText, FileCode, BookOpen, ClipboardList, CheckSquare, Braces, Settings, User, Github } from 'lucide-react';
import { templatesApi, TemplateInfo } from '@/api/templates';
import { Folder } from '@/types';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const ICON_MAP: Record<string, React.ElementType> = {
  'ti-file-text':    FileText,
  'ti-markdown':     FileCode,
  'ti-brand-github': Github,
  'ti-notes':        ClipboardList,
  'ti-checkbox':     CheckSquare,
  'ti-braces':       Braces,
  'ti-settings':     Settings,
  'ti-book':         BookOpen,
  'ti-id-badge':     User,
};

const CATEGORIES = ['All', 'Documents', 'Code', 'Personal'] as const;
type Category = typeof CATEGORIES[number];

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  currentFolderId: string | null;
  currentFolders: Folder[];
  onSuccess: () => void;
}

export default function TemplateModal({ open, onClose, currentFolderId, currentFolders, onSuccess }: TemplateModalProps) {
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>('All');
  const [selected, setSelected] = useState<TemplateInfo | null>(null);
  const [fileName, setFileName] = useState('');
  const [saveFolderId, setSaveFolderId] = useState<string | null>(currentFolderId);
  const [creating, setCreating] = useState(false);

  const { data } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll(),
    enabled: open,
    staleTime: Infinity,
  });

  const templates = data?.data ?? [];
  const filtered = category === 'All' ? templates : templates.filter(t => t.category === category);

  useEffect(() => {
    if (open) {
      setCategory('All');
      setSelected(null);
      setFileName('');
      setSaveFolderId(currentFolderId);
    }
  }, [open, currentFolderId]);

  useEffect(() => {
    if (selected) setFileName(selected.name);
  }, [selected]);

  if (!open) return null;

  const create = async (openEditor: boolean) => {
    if (!selected) return;
    if (!fileName.trim()) { toast.error('Please enter a file name'); return; }
    setCreating(true);
    try {
      const res = await templatesApi.create(selected.id, { folderId: saveFolderId ?? undefined, fileName: fileName.trim() });
      if (!res.success || !res.data) throw new Error(res.error ?? 'Failed');
      toast.success(`'${res.data.fileName}' created successfully!`);
      onSuccess();
      onClose();
      if (openEditor) navigate(res.data.editorUrl);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create file');
    } finally {
      setCreating(false);
    }
  };

  const saveFolderName = saveFolderId
    ? (currentFolders.find(f => f.id === saveFolderId)?.name ?? 'Folder')
    : 'My Drive';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          <h2 className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Create from template</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-2 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                category === c
                  ? 'bg-[#4F46E5] text-white'
                  : 'text-[#6B7280] dark:text-[#888888] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-3 gap-3 content-start">
          {filtered.map(tpl => {
            const Icon = ICON_MAP[tpl.icon] ?? FileText;
            const isSelected = selected?.id === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => setSelected(tpl)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all hover:border-[#4F46E5] hover:shadow-sm ${
                  isSelected
                    ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 shadow-sm'
                    : 'border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] hover:bg-[#F9F9FF] dark:hover:bg-[#1e1b4b]/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-[#4F46E5]' : 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/30'}`}>
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-[#4F46E5]'}`} strokeWidth={1.5} />
                </div>
                <span className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] leading-tight">{tpl.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#252525] text-[#6B7280] dark:text-[#888888] font-mono">.{tpl.extension}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom controls */}
        <div className="px-5 py-4 border-t border-[#E5E5E5] dark:border-[#2A2A2A] space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#555555] uppercase tracking-wider mb-1">File name</label>
              <input
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder="Name your file..."
                className="w-full h-8 px-3 text-xs bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] outline-none focus:border-[#4F46E5] transition-colors"
                onKeyDown={e => e.key === 'Enter' && create(true)}
              />
            </div>
            <div className="w-44">
              <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#555555] uppercase tracking-wider mb-1">Save to</label>
              <select
                value={saveFolderId ?? ''}
                onChange={e => setSaveFolderId(e.target.value || null)}
                className="w-full h-8 px-2 text-xs bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-[#F5F5F5] outline-none focus:border-[#4F46E5] transition-colors cursor-pointer"
              >
                <option value="">My Drive</option>
                {currentFolders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selected && (
            <p className="text-[10px] text-[#9CA3AF] dark:text-[#555555]">
              Creating <span className="font-medium text-[#6B7280] dark:text-[#888888]">{fileName || selected.name}.{selected.extension}</span>
              {' '}in <span className="font-medium text-[#6B7280] dark:text-[#888888]">{saveFolderName}</span>
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => create(true)}
              disabled={!selected || !fileName.trim() || creating}
              className="flex-1 h-8 text-xs font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {creating ? 'Creating…' : 'Create & Edit'}
            </button>
            <button
              onClick={() => create(false)}
              disabled={!selected || !fileName.trim() || creating}
              className="flex-1 h-8 text-xs font-medium text-[#4F46E5] border border-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#1e1b4b]/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Create Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
