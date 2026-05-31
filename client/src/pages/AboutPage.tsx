import { Link } from 'react-router-dom';
import { ArrowLeft, Code2, Database, Globe, Zap, Cpu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import SocialButtons from '@/components/SocialButtons';

const TECH_STACK = [
  {
    title: 'Frontend',
    icon: Code2,
    items: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
    color: '#4F46E5',
  },
  {
    title: 'Backend',
    icon: Globe,
    items: ['Node.js', 'Express', 'TypeScript', 'Prisma'],
    color: '#10B981',
  },
  {
    title: 'Database',
    icon: Database,
    items: ['SQLite'],
    color: '#F59E0B',
  },
  {
    title: 'Real-time',
    icon: Zap,
    items: ['WebSockets'],
    color: '#EC4899',
  },
  {
    title: 'AI',
    icon: Cpu,
    items: ['Google Gemini'],
    color: '#8B5CF6',
  },
];

export default function AboutPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-[#0A0A0A] dark:text-[#F5F5F5]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Back
          </Link>

          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4F46E5] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight">CloudDrive</span>
          </Link>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-[#6B6B6B] dark:text-[#888888] hover:bg-[#F8F8F8] dark:hover:bg-[#141414] transition-all"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" strokeWidth={1.5} />
              : <Moon className="w-4 h-4" strokeWidth={1.5} />
            }
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-16 space-y-20">

        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-[#1e1b4b]/30 mb-6">
            <svg width="32" height="32" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="#4F46E5" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">About CloudDrive</h1>
          <p className="text-xl text-[#6B6B6B] dark:text-[#888888] max-w-xl mx-auto">
            A modern cloud storage platform built with passion
          </p>
        </div>

        {/* Story */}
        <section>
          <div className="bg-[#F8F8F8] dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-4">Our Story</p>
            <p className="text-base text-[#374151] dark:text-[#D1D5DB] leading-relaxed">
              CloudDrive was built as a portfolio project to demonstrate full-stack development
              capabilities. It features everything you'd expect from a professional cloud storage
              service — file management with versioning, real-time collaboration, a community forum,
              direct messaging, friend connections, and even AI-powered assistance. Every part of
              the stack was crafted from scratch with attention to both developer experience and
              end-user polish.
            </p>
          </div>
        </section>

        {/* Tech stack */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-4">Tech Stack</p>
          <h2 className="text-3xl font-bold mb-8">Built with modern tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TECH_STACK.map(({ title, icon: Icon, items, color }) => (
              <div
                key={title}
                className="border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5 bg-white dark:bg-[#141414] hover:border-[#4F46E5] dark:hover:border-[#6366f1] transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: color + '20' }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.5} />
                  </div>
                  <span className="font-semibold text-sm text-[#0A0A0A] dark:text-[#F5F5F5]">{title}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(item => (
                    <span
                      key={item}
                      className="text-xs px-2 py-1 rounded-lg bg-[#F8F8F8] dark:bg-[#1E1E1E] text-[#374151] dark:text-[#9CA3AF] border border-[#E5E5E5] dark:border-[#2A2A2A]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Developer */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#4F46E5] dark:text-[#6366f1] mb-4">The Developer</p>
          <h2 className="text-3xl font-bold mb-8">Meet the builder</h2>
          <div className="border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-2xl p-8 bg-white dark:bg-[#141414] flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-[#4F46E5] flex items-center justify-center text-white text-2xl font-bold shrink-0 select-none">
              UK
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5] mb-0.5">Utku</h3>
              <p className="text-sm text-[#4F46E5] dark:text-[#6366f1] font-medium mb-3">Full-Stack Developer</p>
              <p className="text-sm text-[#6B6B6B] dark:text-[#888888] leading-relaxed mb-5 max-w-md">
                Built CloudDrive from scratch as a portfolio project showcasing modern web
                development — from the Express API and Prisma data layer all the way to the React
                UI with real-time WebSockets.
              </p>
              <SocialButtons gradientId="ig-about" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E5E5] dark:border-[#2A2A2A] py-8 px-5 sm:px-8 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-[#6B6B6B] dark:text-[#888888] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
            <div className="w-5 h-5 rounded bg-[#4F46E5] flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6C2.5 8.5 4.5 10.5 7 10.5H10C11.1 10.5 12 9.6 12 8.5C12 7.4 11.1 6.5 10 6.5H9.5V6C9.5 3.5 8 1.5 7 1.5Z" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-medium">CloudDrive</span>
          </Link>
          <p className="text-xs text-[#AAAAAA] dark:text-[#444444]">
            © {new Date().getFullYear()} CloudDrive. Built with passion.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#AAAAAA] dark:text-[#444444]">
            <Link to="/changelog" className="hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">Changelog</Link>
            <Link to="/forum" className="hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">Forum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
