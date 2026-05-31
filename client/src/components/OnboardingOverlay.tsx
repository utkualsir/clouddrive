import { useState, useRef, useCallback, useEffect } from 'react';
import { Cloud, Upload, FolderPlus, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { usersApi } from '@/api/users';
import api from '@/api/axios';

interface Props {
  displayName: string;
  onComplete: () => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981'];
const TOTAL_STEPS = 4;

function fireConfetti() {
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'] });
}

export default function OnboardingOverlay({ displayName, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');
  const [animating, setAnimating] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [uploadedCount, setUploadedCount] = useState(0);
  const [createdFolderCount, setCreatedFolderCount] = useState(0);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(COLORS[0]);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const advance = useCallback((nextStep: number) => {
    if (animating) return;
    setAnimating(true);
    setSlideDir('left');
    setTimeout(() => {
      setStep(nextStep);
      setSlideDir('right');
      setAnimating(false);
    }, 260);
  }, [animating]);

  const saveStep = useCallback((s: number) => {
    usersApi.updateOnboarding({ step: s }).catch(console.error);
  }, []);

  const handleComplete = useCallback(() => {
    usersApi.updateOnboarding({ step: 4, completed: true }).catch(console.error);
    onComplete();
  }, [onComplete]);

  // Auto-redirect 2 seconds after reaching the complete step
  useEffect(() => {
    if (step !== 3) { setCountdown(null); return; }
    setCountdown(2);
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c === null || c <= 1) { clearInterval(tick); return null; }
        return c - 1;
      });
    }, 1000);
    const done = setTimeout(() => handleComplete(), 2000);
    return () => { clearInterval(tick); clearTimeout(done); };
  }, [step, handleComplete]);

  const handleUpload = useCallback(async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/api/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadedCount(1);
      fireConfetti();
      setTimeout(() => { saveStep(2); advance(2); }, 900);
    } catch {
      toast.error('Upload failed, try again');
    } finally {
      setUploading(false);
    }
  }, [uploading, saveStep, advance]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleCreateFolder = useCallback(async () => {
    if (!folderName.trim() || creatingFolder) return;
    setCreatingFolder(true);
    try {
      await api.post('/api/folders', { name: folderName.trim(), color: folderColor });
      setCreatedFolderCount(1);
      fireConfetti();
      saveStep(3);
      setTimeout(() => advance(3), 900);
    } catch {
      toast.error('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  }, [folderName, folderColor, creatingFolder, saveStep, advance]);

  const skipStep = useCallback((nextStep: number) => {
    saveStep(nextStep);
    advance(nextStep);
  }, [saveStep, advance]);

  const skipAll = useCallback(() => {
    usersApi.updateOnboarding({ step: 4, completed: true }).catch(console.error);
    onComplete();
  }, [onComplete]);

  // Progress as percentage (step 0 = 0%, step 3 = 100%)
  const progressPct = (step / (TOTAL_STEPS - 1)) * 100;

  const steps = [
    // Step 0 — Welcome
    <div key="welcome" className="text-center">
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center animate-bounce">
          <Cloud className="w-10 h-10 text-[#4F46E5]" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] mb-3">
        Welcome to CloudDrive, {displayName}! 👋
      </h2>
      <p className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-10 leading-relaxed">
        Let's get you set up in 3 quick steps
      </p>
      <button
        onClick={() => { saveStep(1); advance(1); }}
        className="w-full h-11 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-sm rounded-xl transition-colors"
      >
        Let's go →
      </button>
    </div>,

    // Step 1 — Upload first file
    <div key="upload">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
          <Upload className="w-4.5 h-4.5 text-[#4F46E5]" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">Upload your first file</h2>
          <p className="text-xs text-[#6B6B6B] dark:text-[#888888]">Drag a file here or click to upload</p>
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 mb-6 ${
          dragging
            ? 'border-[#4F46E5] bg-indigo-50 dark:bg-indigo-950/20 scale-[1.01]'
            : 'border-[#E5E5E5] dark:border-[#2A2A2A] hover:border-[#4F46E5] hover:bg-[#F8F8F8] dark:hover:bg-[#1A1A1A]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">Uploading…</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-[#AAAAAA] dark:text-[#444444] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">
              <span className="font-medium text-[#4F46E5]">Click to browse</span> or drag & drop any file
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => skipStep(2)}
        className="w-full text-xs text-[#AAAAAA] dark:text-[#444444] hover:text-[#4F46E5] transition-colors"
      >
        Skip this step
      </button>
    </div>,

    // Step 2 — Create first folder
    <div key="folder">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
          <FolderPlus className="w-4.5 h-4.5 text-[#4F46E5]" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">Create your first folder</h2>
          <p className="text-xs text-[#6B6B6B] dark:text-[#888888]">Give it a name and pick a color</p>
        </div>
      </div>

      <div className="space-y-5 mb-6">
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444] mb-2">
            Folder name
          </label>
          <input
            type="text"
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
            placeholder="e.g. Work, Photos, Projects…"
            autoFocus
            className="w-full bg-transparent border-b border-[#E5E5E5] dark:border-[#2A2A2A] focus:border-[#4F46E5] pb-2 text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder:text-[#AAAAAA] dark:placeholder:text-[#444444] outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] font-medium uppercase tracking-widest text-[#AAAAAA] dark:text-[#444444] mb-3">
            Color
          </label>
          <div className="flex gap-2.5">
            {COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setFolderColor(color)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{ backgroundColor: color, boxShadow: folderColor === color ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none' }}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleCreateFolder}
        disabled={!folderName.trim() || creatingFolder}
        className="w-full h-11 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors mb-3"
      >
        {creatingFolder ? 'Creating…' : 'Create folder'}
      </button>
      <button
        type="button"
        onClick={() => skipStep(3)}
        className="w-full text-xs text-[#AAAAAA] dark:text-[#444444] hover:text-[#4F46E5] transition-colors"
      >
        Skip this step
      </button>
    </div>,

    // Step 3 — Complete
    <div key="complete" className="text-center">
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 rounded-2xl bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-500" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] mb-3">You're all set! 🎉</h2>
      <div className="text-sm text-[#6B6B6B] dark:text-[#888888] mb-6 space-y-1">
        {uploadedCount > 0 && <p>✓ Uploaded {uploadedCount} file</p>}
        {createdFolderCount > 0 && <p>✓ Created {createdFolderCount} folder</p>}
        <p className="text-xs mt-2 opacity-70">Your cloud storage is ready to use.</p>
      </div>
      <p className="text-xs text-[#AAAAAA] dark:text-[#555555] mb-4">
        Redirecting to your drive{countdown !== null ? ` in ${countdown}s` : '…'}
      </p>
      <button
        onClick={handleComplete}
        className="w-full h-11 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-sm rounded-xl transition-colors"
      >
        Go to my drive →
      </button>
    </div>,
  ];

  const slideClass = animating
    ? slideDir === 'left'
      ? 'opacity-0 -translate-x-4'
      : 'opacity-0 translate-x-4'
    : 'opacity-100 translate-x-0';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[480px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl p-8 overflow-hidden">

        {/* Animated progress bar */}
        <div className="mb-8">
          <div className="h-1 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4F46E5] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-[#AAAAAA] dark:text-[#444444] mt-1.5 text-right">
            Step {Math.min(step + 1, TOTAL_STEPS)} of {TOTAL_STEPS}
          </p>
        </div>

        {/* Step content with slide animation */}
        <div className={`transition-all duration-250 ease-in-out ${slideClass}`}>
          {steps[step]}
        </div>

        {/* Skip setup — always visible on steps 1-2 */}
        {step > 0 && step < 3 && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={skipAll}
              className="text-[11px] text-[#CCCCCC] dark:text-[#444444] hover:text-[#AAAAAA] dark:hover:text-[#666666] transition-colors"
            >
              Skip setup entirely
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
