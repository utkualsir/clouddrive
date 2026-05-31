import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'hu', label: 'Magyar', flag: '🇭🇺' },
];

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.code === (i18n.language?.slice(0, 2))) ?? LANGUAGES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('clouddrive-language', code);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#6B6B6B] dark:text-[#888888] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg hover:border-[#AAAAAA] dark:hover:border-[#444444] transition-colors bg-transparent"
        aria-label="Change language"
      >
        <span className="text-sm leading-none">{currentLang.flag}</span>
        <span className="hidden sm:inline font-medium">{currentLang.label}</span>
        <ChevronDown className={`w-3 h-3 opacity-50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-40 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-[300] overflow-hidden animate-modal-in">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                currentLang.code === lang.code
                  ? 'text-[#4F46E5] dark:text-[#6366f1] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30'
                  : 'text-[#0A0A0A] dark:text-[#F5F5F5] hover:bg-[#F8F8F8] dark:hover:bg-[#1E1E1E]'
              }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
