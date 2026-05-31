import { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, ArrowRight, Globe, Users, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatFileSize } from '@/lib/utils';
import { FileDot } from '@/components/FileIcon';
import { FileVisibility } from '@/types';
import toast from 'react-hot-toast';

interface UploadFile {
  file: globalThis.File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

const VISIBILITY_OPTIONS: { value: FileVisibility; label: string; desc: string; icon: typeof Globe }[] = [
  { value: 'PRIVATE', label: 'Private', desc: 'Only me', icon: Lock },
  { value: 'FRIENDS', label: 'Friends', desc: 'Friends & followers', icon: Users },
  { value: 'PUBLIC',  label: 'Public',  desc: 'Anyone', icon: Globe },
];

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  folderId: string | null;
  onSuccess: () => void;
}

export default function UploadModal({ open, onClose, folderId, onSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [visibility, setVisibility] = useState<FileVisibility>('PRIVATE');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('token');

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setFiles(prev => [
      ...prev,
      ...Array.from(incoming).map(f => ({ file: f, progress: 0, status: 'pending' as const })),
    ]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const uploadFile = (index: number): Promise<void> => new Promise(resolve => {
    const item = files[index];
    if (!item) { resolve(); return; }

    const fd = new FormData();
    fd.append('file', item.file);
    if (folderId) fd.append('folderId', folderId);
    fd.append('visibility', visibility);

    const xhr = new XMLHttpRequest();
    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
    xhr.open('POST', `${base}/api/files/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        setFiles(prev => prev.map((f, i) => i === index ? { ...f, progress: Math.round((e.loaded / e.total) * 100), status: 'uploading' } : f));
      }
    };
    xhr.onload = () => {
      const success = xhr.status >= 200 && xhr.status < 300;
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, progress: success ? 100 : f.progress, status: success ? 'done' : 'error', error: success ? undefined : (() => { try { return JSON.parse(xhr.responseText)?.error; } catch { return 'Upload failed'; } })() } : f));
      resolve();
    };
    xhr.onerror = () => {
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'error', error: 'Network error' } : f));
      resolve();
    };
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'uploading' } : f));
    xhr.send(fd);
  });

  const startUpload = async () => {
    const pending = files.map((_, i) => i).filter(i => files[i].status === 'pending');
    for (const i of pending) await uploadFile(i);
    const doneCount = files.filter(f => f.status === 'done').length + pending.filter(i => files[i]?.status === 'done').length;
    if (doneCount > 0) { toast.success(`${doneCount} file${doneCount > 1 ? 's' : ''} uploaded!`); onSuccess(); }
    setTimeout(() => { setFiles([]); onClose(); }, 600);
  };

  const handleClose = () => { setFiles([]); setVisibility('PRIVATE'); onClose(); };
  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-[#4F46E5] dark:border-[#6366f1] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30'
              : 'border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#AAAAAA] dark:hover:border-[#444444] hover:bg-[#F8F8F8] dark:hover:bg-[#141414]'
          }`}
        >
          <div className="w-10 h-10 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] flex items-center justify-center mx-auto mb-3">
            <Upload className="w-5 h-5 text-[#AAAAAA] dark:text-[#444444]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-[#0A0A0A] dark:text-[#F5F5F5] mb-1">
            {isDragging ? 'Drop to upload' : 'Drop files here'}
          </p>
          <p className="text-xs text-[#AAAAAA] dark:text-[#444444]">or click to browse — max 100 MB</p>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {files.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#F8F8F8] dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A]">
                <FileDot mimeType={item.file.type || 'application/octet-stream'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[11px] text-[#AAAAAA] dark:text-[#444444]">{formatFileSize(item.file.size)}</span>
                      {item.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" strokeWidth={2} />}
                      {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" strokeWidth={2} />}
                      {item.status === 'pending' && (
                        <button onClick={e => { e.stopPropagation(); setFiles(p => p.filter((_, idx) => idx !== i)); }} className="text-[#AAAAAA] dark:text-[#444444] hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                  {(item.status === 'uploading' || item.status === 'done') && (
                    <div className="h-[2px] bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4F46E5] rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === 'error' && <p className="text-[11px] text-red-500">{item.error ?? 'Upload failed'}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Visibility selector */}
        <div>
          <p className="text-[11px] font-medium text-[#6B7280] dark:text-[#555555] mb-1.5">Who can see these files?</p>
          <div className="flex gap-1.5">
            {VISIBILITY_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setVisibility(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs transition-all ${
                    active
                      ? 'border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 text-[#4F46E5]'
                      : 'border-[#E5E5E5] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#555555] hover:border-[#AAAAAA] dark:hover:border-[#444444]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              );
            })}
          </div>
          {visibility === 'PUBLIC' && (
            <p className="text-[10px] text-[#9CA3AF] mt-1">Public files appear on your profile</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleClose} className="flex-1 h-9 text-sm font-medium border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-colors">
            Cancel
          </button>
          <button
            onClick={startUpload}
            disabled={pendingCount === 0}
            className="flex-1 h-9 text-sm font-medium flex items-center justify-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Upload {pendingCount > 0 ? `${pendingCount} file${pendingCount > 1 ? 's' : ''}` : ''}
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
