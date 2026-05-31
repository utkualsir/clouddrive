import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  onCommandPalette: () => void;
  onShortcutsHelp: () => void;
  onEscape: () => void;
  onNavigateTo?: (path: string) => void;
}

export function useKeyboardShortcuts({ onCommandPalette, onShortcutsHelp, onEscape, onNavigateTo }: UseKeyboardShortcutsOptions) {
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (e.key === 'Escape') {
        onEscape();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'k') {
          e.preventDefault();
          onCommandPalette();
          return;
        }
        if (!inInput) {
          if (k === 'u') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('clouddrive:open-upload'));
            return;
          }
          if (k === 'f') {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('clouddrive:focus-search'));
            return;
          }
        }
        return;
      }

      if (inInput) return;

      if (e.key === '?') {
        onShortcutsHelp();
        return;
      }

      if (e.key === 'Delete') {
        window.dispatchEvent(new CustomEvent('clouddrive:delete-selected'));
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        gPressedRef.current = true;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        gTimerRef.current = window.setTimeout(() => { gPressedRef.current = false; }, 1500);
        return;
      }

      if (gPressedRef.current) {
        gPressedRef.current = false;
        if (gTimerRef.current) { clearTimeout(gTimerRef.current); gTimerRef.current = null; }

        // Drive view shortcuts (handled by DrivePage via custom event)
        const viewMap: Record<string, string> = { h: 'drive', r: 'recent', s: 'starred', t: 'trash' };
        const view = viewMap[e.key.toLowerCase()];
        if (view) {
          window.dispatchEvent(new CustomEvent('clouddrive:navigate', { detail: { view } }));
          return;
        }

        // Page-level navigation shortcuts
        const routeMap: Record<string, string> = { f: '/forum', m: '/messages', p: '/profile' };
        const route = routeMap[e.key.toLowerCase()];
        if (route) {
          onNavigateTo?.(route);
          return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [onCommandPalette, onShortcutsHelp, onEscape, onNavigateTo]);
}
