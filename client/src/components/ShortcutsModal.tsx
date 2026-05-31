import { X } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutRow[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'H'], description: 'Go to My Drive' },
      { keys: ['G', 'R'], description: 'Go to Recent' },
      { keys: ['G', 'S'], description: 'Go to Starred' },
      { keys: ['G', 'T'], description: 'Go to Trash' },
      { keys: ['G', 'F'], description: 'Go to Forum' },
      { keys: ['G', 'M'], description: 'Go to Messages' },
      { keys: ['G', 'P'], description: 'Go to your Profile' },
    ],
  },
  {
    title: 'File Actions',
    shortcuts: [
      { keys: ['Ctrl', 'U'], description: 'Upload files' },
      { keys: ['Ctrl', 'F'], description: 'Focus search bar' },
      { keys: ['Delete'], description: 'Delete selected files' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / cancel' },
    ],
  },
];

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center px-2 py-0.5 min-w-[1.5rem] text-[11px] font-mono font-medium rounded border border-[#D0D0D0] dark:border-[#3A3A3A] bg-[#F8F8F8] dark:bg-[#1E1E1E] text-[#0A0A0A] dark:text-[#F5F5F5] shadow-[0_1px_0_rgba(0,0,0,0.15)] dark:shadow-[0_1px_0_rgba(0,0,0,0.5)]">
      {label}
    </kbd>
  );
}

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#141414] rounded-2xl border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-2xl overflow-hidden animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5] dark:border-[#2A2A2A]">
          <h2 className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] hover:bg-[#F0F0F0] dark:hover:bg-[#1E1E1E] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {GROUPS.map(group => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#AAAAAA] dark:text-[#444444] mb-2">{group.title}</p>
              <div className="space-y-2">
                {group.shortcuts.map(s => (
                  <div key={s.description} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-[#6B6B6B] dark:text-[#888888]">{s.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-[#AAAAAA]">then</span>}
                          <KeyBadge label={k} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
