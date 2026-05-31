import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { useTheme } from '@/contexts/ThemeContext';

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  title: string;
  changes: { type: 'new' | 'improved' | 'fixed'; text: string }[];
}

const TYPE_LABELS: Record<string, string> = {
  major: 'Major Release',
  minor: 'Minor Update',
  patch: 'Patch',
};

const TYPE_STYLES: Record<string, string> = {
  major: 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5] dark:text-[#6366f1]',
  minor: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  patch: 'bg-[#F3F4F6] dark:bg-[#1E1E1E] text-[#6B7280] dark:text-[#888888]',
};

const CHANGE_DOT: Record<string, string> = {
  new: 'bg-emerald-500',
  improved: 'bg-blue-500',
  fixed: 'bg-red-500',
};

const CHANGE_LABEL: Record<string, string> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ChangelogPage() {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const { data, isLoading } = useQuery<ChangelogEntry[]>({
    queryKey: ['changelog'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ChangelogEntry[] }>('/changelog');
      return res.data.data ?? [];
    },
  });

  const entries = data ?? [];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-[#E5E5E5] dark:border-[#2A2A2A] bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-[#6B7280] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Back
          </Link>
          <span className="text-[#E5E5E5] dark:text-[#2A2A2A]">/</span>
          <span className="text-sm font-medium">Changelog</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-16">
        {/* Header */}
        <div className="mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 text-[#4F46E5] dark:text-[#6366f1] text-xs font-semibold mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] dark:bg-[#6366f1] animate-pulse" />
            Latest: v2.0.0
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">Changelog</h1>
          <p className="text-lg text-[#6B6B6B] dark:text-[#888888]">What's new in CloudDrive</p>
        </div>

        {isLoading && (
          <div className="space-y-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex gap-8">
                <div className="w-24 shrink-0 h-4 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded mt-1" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded w-1/3" />
                  <div className="h-4 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded w-2/3" />
                  <div className="h-4 bg-[#E5E5E5] dark:bg-[#2A2A2A] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        {!isLoading && (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-[#E5E5E5] dark:bg-[#2A2A2A]" />

            <div className="space-y-12">
              {entries.map((entry, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={entry.version} className="flex gap-0">
                    {/* Left: version info */}
                    <div className="w-28 shrink-0 text-right pr-6 pt-1">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#555555] mb-0.5">
                        {formatDate(entry.date).split(' ').slice(0, 2).join(' ')}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] dark:text-[#444444]">
                        {formatDate(entry.date).split(' ')[2]}
                      </p>
                    </div>

                    {/* Dot */}
                    <div className="relative flex items-start pt-1.5 z-10">
                      <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-[#0A0A0A] shrink-0 ${isLatest ? 'bg-[#4F46E5]' : 'bg-[#D1D5DB] dark:bg-[#3A3A3A]'}`} />
                    </div>

                    {/* Right: content */}
                    <div className={`flex-1 ml-5 pb-2 ${isLatest ? 'border-l-2 border-[#4F46E5] pl-5 -ml-px bg-[#EEF2FF]/30 dark:bg-[#1e1b4b]/10 rounded-r-xl pr-5 py-4' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xl font-bold tracking-tight">{entry.version}</span>
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${TYPE_STYLES[entry.type]}`}>
                          {TYPE_LABELS[entry.type]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#374151] dark:text-[#CCCCCC] mb-3">{entry.title}</p>

                      <ul className="space-y-2">
                        {entry.changes.map((change, ci) => (
                          <li key={ci} className="flex items-start gap-2.5 text-sm text-[#6B7280] dark:text-[#888888]">
                            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${CHANGE_DOT[change.type]}`} />
                            <span>
                              <span className={`font-medium mr-1 ${
                                change.type === 'new' ? 'text-emerald-600 dark:text-emerald-400' :
                                change.type === 'improved' ? 'text-blue-600 dark:text-blue-400' :
                                'text-red-500 dark:text-red-400'
                              }`}>
                                {CHANGE_LABEL[change.type]}:
                              </span>
                              {change.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
