import { useEffect, useRef, useState, useCallback } from 'react';
import { BarChart2, FileText, Folder, FolderPlus, MessagesSquare, Search, Settings, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '@/api/search';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface ResultItem {
  id: string;
  type: 'file' | 'folder' | 'action' | 'search';
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

const MAX_RECENT = 5;
const RECENT_KEY = 'clouddrive-recent-searches';

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]; } catch { return []; }
}

function saveRecent(q: string) {
  const prev = loadRecent();
  const next = [q, ...prev.filter(s => s !== q)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STATIC_ACTIONS: ResultItem[] = [
    { id: 'upload', type: 'action', label: 'Upload file', icon: <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />, onSelect: () => { onClose(); window.dispatchEvent(new CustomEvent('clouddrive:open-upload')); } },
    { id: 'new-folder', type: 'action', label: 'New folder', icon: <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.5} />, onSelect: () => { onClose(); window.dispatchEvent(new CustomEvent('clouddrive:new-folder')); } },
    { id: 'new-thread', type: 'action', label: 'New forum thread', icon: <MessagesSquare className="w-3.5 h-3.5" strokeWidth={1.5} />, onSelect: () => { onClose(); navigate('/forum/new'); } },
    { id: 'settings', type: 'action', label: 'Go to Settings', icon: <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />, onSelect: () => { onClose(); navigate('/settings'); } },
    { id: 'stats', type: 'action', label: 'View Statistics', icon: <BarChart2 className="w-3.5 h-3.5" strokeWidth={1.5} />, onSelect: () => { onClose(); navigate('/stats'); } },
  ];

  const buildEmptyResults = useCallback((): ResultItem[] => {
    const recent = loadRecent();
    const recentItems: ResultItem[] = recent.map(r => ({
      id: `recent-${r}`,
      type: 'search',
      label: r,
      icon: <Search className="w-3.5 h-3.5" strokeWidth={1.5} />,
      onSelect: () => { setQuery(r); },
    }));
    return [...recentItems, ...STATIC_ACTIONS];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(buildEmptyResults()); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await searchApi.search(q);
      const items: ResultItem[] = [];
      if (res.data) {
        (res.data.folders ?? []).slice(0, 5).forEach(f => items.push({
          id: `folder-${f.id}`, type: 'folder', label: f.name,
          icon: <Folder className="w-3.5 h-3.5 text-[#F59E0B]" strokeWidth={1.5} />,
          onSelect: () => { onClose(); window.dispatchEvent(new CustomEvent('clouddrive:navigate', { detail: { view: 'drive' } })); },
        }));
        (res.data.files ?? []).slice(0, 5).forEach(f => items.push({
          id: `file-${f.id}`, type: 'file', label: f.name,
          icon: <FileText className="w-3.5 h-3.5 text-[#4F46E5]" strokeWidth={1.5} />,
          onSelect: () => { onClose(); window.dispatchEvent(new CustomEvent('clouddrive:search', { detail: { q: f.name } })); },
        }));
      }
      const filteredActions = STATIC_ACTIONS.filter(a => a.label.toLowerCase().includes(q.toLowerCase()));
      setResults([...items, ...filteredActions]);
    } catch {
      setResults(STATIC_ACTIONS);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setResults(buildEmptyResults());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, buildEmptyResults]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => { setActive(0); }, [results.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) {
      if (query.trim()) saveRecent(query.trim());
      results[active].onSelect();
    }
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  const typeLabel: Record<ResultItem['type'], string> = {
    file: 'file',
    folder: 'folder',
    action: 'action',
    search: 'recent',
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[10vh] px-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-2xl overflow-hidden animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          <Search className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444] shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files, folders, or actions…"
            className="flex-1 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] bg-transparent placeholder:text-[#AAAAAA] focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#AAAAAA] hover:text-[#6B6B6B] transition-colors">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-[#AAAAAA] dark:text-[#444444]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#AAAAAA] dark:text-[#444444]">No results found</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => { if (query.trim()) saveRecent(query.trim()); item.onSelect(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === active ? 'bg-[#F0F0F0] dark:bg-[#1E1E1E]' : 'hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A]'
                }`}
              >
                <span className="text-[#6B6B6B] dark:text-[#888888] shrink-0">{item.icon}</span>
                <span className="flex-1 text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{item.label}</span>
                <span className="text-[10px] text-[#AAAAAA] dark:text-[#444444] shrink-0">{typeLabel[item.type]}</span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center gap-3 text-[10px] text-[#AAAAAA] dark:text-[#444444]">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
