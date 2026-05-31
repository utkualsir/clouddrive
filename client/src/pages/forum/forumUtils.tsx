import { MessageSquare, HelpCircle, Share2, Lightbulb, Megaphone, Hash, LucideIcon } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

// ── Time ────────────────────────────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Icon mapping (Tabler → Lucide) ──────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  'ti-messages':     MessageSquare,
  'ti-messages-2':   MessageSquare,
  'ti-help':         HelpCircle,
  'ti-share':        Share2,
  'ti-bulb':         Lightbulb,
  'ti-speakerphone': Megaphone,
};

export function CategoryIcon({ icon, color, size = 20 }: { icon: string; color: string; size?: number }) {
  const Icon = ICON_MAP[icon] ?? Hash;
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0"
      style={{ backgroundColor: color + '20', width: size + 16, height: size + 16 }}
    >
      <Icon style={{ color, width: size, height: size }} strokeWidth={1.8} />
    </div>
  );
}

// ── Markdown renderer ────────────────────────────────────────────────────────

marked.setOptions({ breaks: true });

export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked(content) as string);
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function Avatar({
  user,
  size = 36,
}: {
  user: { displayName: string; avatarColor: string; avatarUrl: string | null };
  size?: number;
}) {
  const src = user.avatarUrl ? `${apiBase}${user.avatarUrl}` : null;
  const style = { width: size, height: size, backgroundColor: user.avatarColor };
  const fontSize = Math.max(10, size * 0.38);
  if (src) {
    return <img src={src} alt={user.displayName} style={style} className="rounded-full object-cover shrink-0" />;
  }
  return (
    <div
      style={{ ...style, fontSize }}
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
    >
      {user.displayName[0]?.toUpperCase()}
    </div>
  );
}

// ── Thread badges ─────────────────────────────────────────────────────────────

export function ThreadBadges({
  isPinned,
  isLocked,
  isSolved,
}: {
  isPinned: boolean;
  isLocked: boolean;
  isSolved: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      {isPinned && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
          📌 Pinned
        </span>
      )}
      {isLocked && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          🔒 Locked
        </span>
      )}
      {isSolved && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
          ✅ Solved
        </span>
      )}
    </span>
  );
}

// ── Tag pill ──────────────────────────────────────────────────────────────────

export function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] dark:bg-[#1E1E1E] text-[#6B7280] dark:text-[#888888]">
      {tag}
    </span>
  );
}
