import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const LERP = 0.15;

const HOVER_SELECTORS = [
  'a', 'button', '[role="button"]', 'label',
  'select', 'input[type="checkbox"]', 'input[type="radio"]',
  '[tabindex]', 'summary',
].join(',');

const TEXT_SELECTORS = [
  'input[type="text"]', 'input[type="email"]', 'input[type="password"]',
  'input[type="search"]', 'input[type="number"]', 'input[type="url"]',
  'textarea', '[contenteditable="true"]',
].join(',');

export default function CustomCursor() {
  const { theme } = useTheme();
  const dotRef    = useRef<HTMLDivElement>(null);
  const ringRef   = useRef<HTMLDivElement>(null);
  const themeRef  = useRef(theme);

  useEffect(() => { themeRef.current = theme; }, [theme]);

  useEffect(() => {
    // Bail out on touch-only devices
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dotEl  = dotRef.current;
    const ringEl = ringRef.current;
    if (!dotEl || !ringEl) return;

    // Mouse position (instant)
    const mouse = { x: -100, y: -100 };
    // Ring position (lerped)
    const ringPos = { x: -100, y: -100 };

    let hovered = false;
    let isText  = false;
    let rafId   = 0;

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const classify = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest(TEXT_SELECTORS)) {
        isText  = true;
        hovered = false;
      } else if (t.closest(HOVER_SELECTORS)) {
        hovered = true;
        isText  = false;
      } else {
        hovered = false;
        isText  = false;
      }
    };

    const onLeave = () => { hovered = false; isText = false; };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', classify, { passive: true });
    document.addEventListener('mouseout',  onLeave,  { passive: true });

    const tick = () => {
      // Lerp ring toward mouse
      ringPos.x += (mouse.x - ringPos.x) * LERP;
      ringPos.y += (mouse.y - ringPos.y) * LERP;

      const isDark  = themeRef.current === 'dark';
      const primary = isDark ? '#FFFFFF' : '#0A0A0A';
      const indigo  = '#4F46E5';

      // --- Dot ---
      // center at cursor: translate(x - half, y - half) then scale
      const dotScale = hovered ? 0 : 1;
      dotEl.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%) scale(${dotScale})`;
      dotEl.style.backgroundColor = hovered ? indigo : primary;

      if (isText) {
        dotEl.style.width        = '2px';
        dotEl.style.height       = '20px';
        dotEl.style.borderRadius = '2px';
        dotEl.style.opacity      = '1';
      } else {
        dotEl.style.width        = '12px';
        dotEl.style.height       = '12px';
        dotEl.style.borderRadius = '50%';
        dotEl.style.opacity      = '1';
      }

      // --- Ring ---
      const ringScale = hovered ? 1.5 : 1;
      const ringBg    = hovered
        ? indigo + (isDark ? '4D' : '33')  // indigo with 30% / 20% opacity
        : 'transparent';
      ringEl.style.transform       = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%) scale(${ringScale})`;
      ringEl.style.borderColor     = hovered ? indigo : primary;
      ringEl.style.backgroundColor = ringBg;
      ringEl.style.opacity         = '0.8';

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', classify);
      document.removeEventListener('mouseout',  onLeave);
    };
  // Run once on mount; theme changes are handled via themeRef
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Dot — instant */}
      <div
        ref={dotRef}
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: theme === 'dark' ? '#FFFFFF' : '#0A0A0A',
          pointerEvents: 'none',
          zIndex: 999999,
          transform: 'translate(-100px, -100px)',
          willChange: 'transform',
          transition: 'background-color 0.1s ease, width 0.12s ease, height 0.12s ease, border-radius 0.12s ease',
        }}
      />

      {/* Ring — laggy */}
      <div
        ref={ringRef}
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `1.5px solid ${theme === 'dark' ? '#FFFFFF' : '#0A0A0A'}`,
          backgroundColor: 'transparent',
          pointerEvents: 'none',
          zIndex: 999998,
          transform: 'translate(-100px, -100px)',
          willChange: 'transform',
          transition: 'border-color 0.12s ease, background-color 0.12s ease',
        }}
      />
    </>
  );
}
