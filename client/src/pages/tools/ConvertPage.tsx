import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileImage, FileText, ImageDown, Upload, Download, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type Phase = 'idle' | 'converting' | 'done' | 'error';

interface ConverterState {
  file: File | null;
  phase: Phase;
  resultUrl: string | null;
  resultName: string | null;
  error: string | null;
  originalSize: number;
  compressedSize: number;
}

function fresh(): ConverterState {
  return { file: null, phase: 'idle', resultUrl: null, resultName: null, error: null, originalSize: 0, compressedSize: 0 };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function DropZone({
  accept, label, file, onFile,
}: {
  accept: string;
  label: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 p-6 min-h-[110px]
        ${dragging ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/20' : 'border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#AAAAAA] dark:hover:border-[#444444] bg-[#F8F8F8] dark:bg-[#141414]'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <Upload className="w-5 h-5 text-[#AAAAAA] dark:text-[#444444]" strokeWidth={1.5} />
      {file ? (
        <>
          <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] text-center truncate max-w-[180px]">{file.name}</p>
          <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{formatSize(file.size)}</p>
        </>
      ) : (
        <>
          <p className="text-xs text-[#6B6B6B] dark:text-[#888888] text-center">{label}</p>
          <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">or click to browse</p>
        </>
      )}
    </div>
  );
}

function ConverterCard({
  icon: Icon,
  title,
  subtitle,
  formats,
  accept,
  dropLabel,
  endpoint,
  extraBody,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  formats: string;
  accept: string;
  dropLabel: string;
  endpoint: string;
  extraBody?: Record<string, string>;
  children?: (state: ConverterState, setState: React.Dispatch<React.SetStateAction<ConverterState>>) => React.ReactNode;
}) {
  const [state, setState] = useState<ConverterState>(fresh());

  const convert = async () => {
    if (!state.file) return;
    setState(s => ({ ...s, phase: 'converting', error: null }));

    const form = new FormData();
    form.append('file', state.file);
    if (extraBody) Object.entries(extraBody).forEach(([k, v]) => form.append(k, v));

    try {
      const res = await fetch(`${API}${endpoint}`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setState(s => ({ ...s, phase: 'error', error: body.error ?? 'Conversion failed' }));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const baseName = state.file.name.replace(/\.[^.]+$/, '');
      const ext = endpoint.includes('compress') ? state.file.name.match(/\.[^.]+$/)?.[0] ?? '' : '.pdf';
      const origSize = state.file.size;
      const compSize = parseInt(res.headers.get('X-Compressed-Size') ?? '0', 10) || blob.size;
      setState(s => ({ ...s, phase: 'done', resultUrl: url, resultName: `${baseName}${ext}`, originalSize: origSize, compressedSize: compSize }));
    } catch {
      setState(s => ({ ...s, phase: 'error', error: 'Network error. Is the server running?' }));
    }
  };

  const reset = () => setState(fresh());

  return (
    <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#4F46E5]" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">{title}</h3>
          <p className="text-xs text-[#6B6B6B] dark:text-[#888888] mt-0.5">{subtitle}</p>
          <span className="inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F0F0F0] dark:bg-[#252525] text-[#6B6B6B] dark:text-[#888888]">{formats}</span>
        </div>
      </div>

      <DropZone accept={accept} label={dropLabel} file={state.file} onFile={f => setState(s => ({ ...s, file: f, phase: 'idle', resultUrl: null, error: null }))} />

      {/* Extra controls slot */}
      {children?.(state, setState)}

      {state.phase === 'error' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          {state.error}
        </div>
      )}

      {state.phase === 'done' && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          Ready to download
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {state.phase === 'done' ? (
          <>
            <a
              href={state.resultUrl!}
              download={state.resultName!}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-medium transition-all"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
              Download {state.resultName}
            </a>
            <button onClick={reset} className="p-2 rounded-lg border border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B6B6B] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </>
        ) : (
          <button
            onClick={convert}
            disabled={!state.file || state.phase === 'converting'}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 text-white text-xs font-medium transition-all"
          >
            {state.phase === 'converting' ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Converting…
              </>
            ) : (
              'Convert'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConvertPage() {
  const navigate = useNavigate();
  const [quality, setQuality] = useState(80);

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Top bar */}
      <div className="border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Back
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] tracking-tight">File Converter</h1>
          <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mt-1">Convert your files instantly, no upload needed</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Image to PDF */}
          <ConverterCard
            icon={FileImage}
            title="Image to PDF"
            subtitle="Fit your image into an A4 PDF page"
            formats="JPG · PNG · WEBP"
            accept="image/jpeg,image/png,image/webp"
            dropLabel="Drop an image here"
            endpoint="/api/tools/image-to-pdf"
          />

          {/* Document to PDF */}
          <ConverterCard
            icon={FileText}
            title="Document to PDF"
            subtitle="Extract text and render into PDF"
            formats="DOCX · DOC · TXT"
            accept=".docx,.doc,.txt"
            dropLabel="Drop a document here"
            endpoint="/api/tools/docx-to-pdf"
          />

          {/* Image Compress */}
          <ConverterCard
            icon={ImageDown}
            title="Image Compress"
            subtitle="Reduce file size while preserving quality"
            formats="JPG · PNG · WEBP"
            accept="image/jpeg,image/png,image/webp"
            dropLabel="Drop an image here"
            endpoint={`/api/tools/image-compress`}
            extraBody={{ quality: String(quality) }}
          >
            {(state) => (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B6B6B] dark:text-[#888888]">Quality</span>
                    <span className="font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{quality}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    onChange={e => setQuality(Number(e.target.value))}
                    className="w-full accent-[#4F46E5]"
                  />
                  <div className="flex justify-between text-[10px] text-[#AAAAAA] dark:text-[#444444]">
                    <span>Smaller</span>
                    <span>Better quality</span>
                  </div>
                </div>
                {state.phase === 'done' && state.originalSize > 0 && (
                  <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[#F0F0F0] dark:bg-[#1E1E1E]">
                    <span className="text-[#6B6B6B] dark:text-[#888888]">{formatSize(state.originalSize)}</span>
                    <span className="text-green-500 font-medium">→ {formatSize(state.compressedSize)}</span>
                    <span className="text-[#AAAAAA] dark:text-[#444444]">
                      -{Math.round((1 - state.compressedSize / state.originalSize) * 100)}%
                    </span>
                  </div>
                )}
              </>
            )}
          </ConverterCard>
        </div>

        {/* Coming soon */}
        <div className="mt-6 p-4 rounded-xl border border-dashed border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F0F0F0] dark:bg-[#1E1E1E] flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-[#AAAAAA] dark:text-[#444444]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-[#AAAAAA] dark:text-[#444444]">More converters coming soon</p>
            <p className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">PDF to Images · Video to MP3 · SVG to PNG</p>
          </div>
        </div>
      </div>
    </div>
  );
}
