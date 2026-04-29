'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Thin top progress bar that fires on every route change.
 * Shows instantly when a nav link is clicked, completes once the pathname changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathRef = useRef(pathname);

  const completeProgress = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 380);
  }, []);

  const startProgress = useCallback(() => {
    setVisible(true);
    setProgress(8);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 88) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 88;
        }
        const increment = prev < 30 ? 8 : prev < 60 ? 4 : prev < 80 ? 1.5 : 0.5;
        return prev + increment;
      });
    }, 80);
  }, []);

  // Listen for link clicks to start the bar immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
      if (href === pathname) return;
      startProgress();
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname, startProgress]);

  // Complete the bar once the pathname actually changes
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      completeProgress();
    }
  }, [pathname, completeProgress]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      style={{ height: 3 }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #7c3aed, #22d3ee)',
          boxShadow: '0 0 10px rgba(124,58,237,0.7)',
          transition: progress === 100
            ? 'width 0.25s ease-out'
            : 'width 0.08s linear',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
}
