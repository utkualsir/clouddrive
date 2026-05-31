import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const promptRef = useRef<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);

  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return;
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as typeof promptRef.current;
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === 'accepted') setShow(false);
    promptRef.current = null;
  };

  const dismiss = () => {
    localStorage.setItem('pwa-dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#4F46E5] text-white text-xs shrink-0">
      <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
      <span className="flex-1">Install CloudDrive as an app for the best experience</span>
      <button
        onClick={install}
        className="px-3 py-1 rounded-md bg-white text-[#4F46E5] font-medium hover:bg-white/90 transition-colors shrink-0"
      >
        Install
      </button>
      <button onClick={dismiss} className="p-0.5 text-white/70 hover:text-white transition-colors shrink-0">
        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
