import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { marked } from 'marked';
import api from '@/api/axios';
import { ApiResponse } from '@/types';

marked.setOptions({ breaks: true });

type EditorMode = 'text' | 'markdown' | 'json' | 'csv';

function getEditorMode(name: string, mimeType: string): EditorMode {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown' || mimeType === 'text/markdown') return 'markdown';
  if (ext === 'json' || mimeType === 'application/json') return 'json';
  if (ext === 'csv' || mimeType === 'text/csv') return 'csv';
  return 'text';
}

// Parse CSV string into 2D array
function parseCSV(csv: string): string[][] {
  if (!csv.trim()) return [['']];
  return csv.split('\n').map(row => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '"') {
        if (inQuotes && row[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (row[i] === ',' && !inQuotes) {
        cells.push(cur); cur = '';
      } else {
        cur += row[i];
      }
    }
    cells.push(cur);
    return cells;
  });
}

// Serialize 2D array to CSV string
function serializeCSV(data: string[][]): string {
  return data.map(row =>
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
}

// Minimal JSON syntax highlighter
function highlightJSON(code: string): string {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      let cls = 'text-[#79c0ff]'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) cls = 'text-[#7ee787]'; // key
        else cls = 'text-[#a5d6ff]'; // string
      } else if (/true|false/.test(match)) cls = 'text-[#ff7b72]'; // bool
      else if (/null/.test(match)) cls = 'text-[#8b949e]'; // null
      return `<span class="${cls}">${match}</span>`;
    });
}

// Synced textarea + line numbers
function TextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);
  const lines = value.split('\n');

  const syncScroll = () => {
    if (lnRef.current && taRef.current) {
      lnRef.current.scrollTop = taRef.current.scrollTop;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div
        ref={lnRef}
        className="w-10 shrink-0 overflow-hidden select-none text-right pr-3 pt-4 pb-4 bg-[#161b22] border-r border-[#30363d]"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '14px', lineHeight: '1.6' }}
        aria-hidden
      >
        {lines.map((_, i) => (
          <div key={i} className="text-[#484f58]">{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        className="flex-1 resize-none bg-[#0d1117] text-[#c9d1d9] px-4 py-4 focus:outline-none caret-[#6366f1]"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '14px', lineHeight: '1.6' }}
      />
    </div>
  );
}

// JSON editor with syntax highlight overlay
function JSONEditor({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lines = value.split('\n');

  const syncScroll = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-900/20 border-b border-red-800/40 text-red-400 text-xs shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          {error}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Line numbers */}
        <div
          className="w-10 shrink-0 overflow-hidden select-none text-right pr-3 pt-4 pb-4 bg-[#161b22] border-r border-[#30363d]"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '14px', lineHeight: '1.6' }}
          aria-hidden
        >
          {lines.map((_, i) => (
            <div key={i} className="text-[#484f58]">{i + 1}</div>
          ))}
        </div>
        {/* Highlight layer + textarea overlay */}
        <div className="relative flex-1 overflow-hidden">
          <pre
            ref={preRef}
            className="absolute inset-0 m-0 px-4 py-4 overflow-auto pointer-events-none text-[#c9d1d9] whitespace-pre"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '14px', lineHeight: '1.6', background: 'transparent' }}
            dangerouslySetInnerHTML={{ __html: highlightJSON(value) + '\n' }}
          />
          <textarea
            ref={taRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onScroll={syncScroll}
            spellCheck={false}
            className="absolute inset-0 resize-none bg-transparent text-transparent px-4 py-4 focus:outline-none caret-[#6366f1] z-10"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '14px', lineHeight: '1.6' }}
          />
        </div>
      </div>
    </div>
  );
}

// Markdown split editor
function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const lines = value.split('\n');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lnRef = useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    if (lnRef.current && taRef.current) {
      lnRef.current.scrollTop = taRef.current.scrollTop;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: raw editor */}
      <div className="flex flex-1 border-r border-[#30363d] overflow-hidden">
        <div
          ref={lnRef}
          className="w-10 shrink-0 overflow-hidden select-none text-right pr-3 pt-4 pb-4 bg-[#161b22] border-r border-[#30363d]"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '14px', lineHeight: '1.6' }}
          aria-hidden
        >
          {lines.map((_, i) => (
            <div key={i} className="text-[#484f58]">{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          className="flex-1 resize-none bg-[#0d1117] text-[#c9d1d9] px-4 py-4 focus:outline-none caret-[#6366f1]"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '14px', lineHeight: '1.6' }}
        />
      </div>
      {/* Right: preview */}
      <div
        className="flex-1 overflow-auto px-6 py-4 bg-[#0d1117] prose prose-invert prose-sm max-w-none"
        style={{ fontFamily: 'system-ui, sans-serif' }}
        dangerouslySetInnerHTML={{ __html: marked(value) as string }}
      />
    </div>
  );
}

// CSV table editor
function CSVEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [data, setData] = useState<string[][]>(() => parseCSV(value));

  useEffect(() => {
    setData(parseCSV(value));
  }, [value]);

  const updateCell = (row: number, col: number, val: string) => {
    const next = data.map(r => [...r]);
    // Ensure row/col exist
    while (next.length <= row) next.push([]);
    while (next[row].length <= col) next[row].push('');
    next[row][col] = val;
    setData(next);
    onChange(serializeCSV(next));
  };

  const maxCols = Math.max(1, ...data.map(r => r.length));

  return (
    <div className="flex-1 overflow-auto bg-[#0d1117] p-4">
      <div className="inline-block min-w-full">
        <table className="border-collapse text-[#c9d1d9]" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '13px' }}>
          <tbody>
            {data.map((row, rIdx) => (
              <tr key={rIdx}>
                <td className="px-2 py-0.5 text-[#484f58] text-right select-none w-8 border border-[#30363d] bg-[#161b22]">
                  {rIdx + 1}
                </td>
                {Array.from({ length: maxCols }).map((_, cIdx) => (
                  <td key={cIdx} className="border border-[#30363d] p-0">
                    <input
                      value={row[cIdx] ?? ''}
                      onChange={e => updateCell(rIdx, cIdx, e.target.value)}
                      className="px-2 py-1 bg-transparent focus:outline-none focus:bg-[#1c2128] min-w-[120px] w-full caret-[#6366f1]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { fileId } = useParams<{ fileId: string }>();

  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<EditorMode>('text');
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  // Load file content
  useEffect(() => {
    if (!fileId) return;
    setIsLoading(true);
    api.get<ApiResponse<{ content: string; name: string; mimeType: string }>>(`/api/files/${fileId}/content`)
      .then(r => {
        if (r.data.success && r.data.data) {
          setContent(r.data.data.content);
          setFileName(r.data.data.name);
          setMode(getEditorMode(r.data.data.name, r.data.data.mimeType));
        } else {
          setLoadError(r.data.error ?? 'Failed to load file');
        }
      })
      .catch(err => {
        setLoadError(err.response?.data?.error ?? 'Failed to load file');
      })
      .finally(() => setIsLoading(false));
  }, [fileId]);

  // JSON validation
  useEffect(() => {
    if (mode !== 'json') return;
    if (!content.trim()) { setJsonError(null); return; }
    try { JSON.parse(content); setJsonError(null); }
    catch (e) { setJsonError((e as Error).message); }
  }, [content, mode]);

  // Dirty tracking
  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    setIsDirty(true);
    setSaveState('idle');
  }, []);

  // Save function
  const save = useCallback(async () => {
    if (!fileId || !isDirty) return;
    setSaveState('saving');
    try {
      await api.put(`/api/files/${fileId}/content`, { content });
      setSaveState('saved');
      setIsDirty(false);
      setLastSaved(new Date());
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
    }
  }, [fileId, content, isDirty]);

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  // Warn on navigate away
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const lastSavedText = () => {
    if (!lastSaved) return null;
    const mins = Math.floor((Date.now() - lastSaved.getTime()) / 60000);
    if (mins < 1) return 'Saved just now';
    return `Saved ${mins}m ago`;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-6 h-6 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0d1117] gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-[#c9d1d9] text-sm">{loadError}</p>
        <Link to="/drive" className="text-[#6366f1] text-sm hover:underline">← Back to Drive</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-12 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <Link
          to="/drive"
          onClick={e => {
            if (isDirty && !confirm('You have unsaved changes. Leave anyway?')) e.preventDefault();
          }}
          className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#c9d1d9] text-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Drive
        </Link>

        <div className="h-4 w-px bg-[#30363d]" />

        {/* File name */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#c9d1d9] text-sm font-medium">{fileName}</span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="Unsaved changes" />
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Mode indicator */}
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e] uppercase tracking-wider">
            {mode}
          </span>

          {/* Last saved */}
          {lastSaved && saveState !== 'saving' && (
            <span className="text-[11px] text-[#484f58]">{lastSavedText()}</span>
          )}

          {/* Save button */}
          <button
            onClick={save}
            disabled={!isDirty || saveState === 'saving'}
            className={`flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md transition-all ${
              saveState === 'saved'
                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                : saveState === 'error'
                ? 'bg-red-600/20 text-red-400 border border-red-600/30'
                : isDirty
                ? 'bg-[#6366f1] hover:bg-[#4f46e5] text-white border border-transparent'
                : 'bg-[#21262d] text-[#484f58] border border-[#30363d] cursor-not-allowed'
            }`}
          >
            {saveState === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveState === 'saved' ? (
              <Check className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden">
        {mode === 'text' && <TextEditor value={content} onChange={handleContentChange} />}
        {mode === 'markdown' && <MarkdownEditor value={content} onChange={handleContentChange} />}
        {mode === 'json' && <JSONEditor value={content} onChange={handleContentChange} error={jsonError} />}
        {mode === 'csv' && <CSVEditor value={content} onChange={handleContentChange} />}
      </div>
    </div>
  );
}
