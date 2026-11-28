import { useEffect, useState } from 'react';

interface VisualViewportState {
  isCompactHeight: boolean;
}

export function useVisualViewport(): VisualViewportState {
  const [isCompactHeight, setIsCompactHeight] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const height = window.visualViewport?.height ?? window.innerHeight;
    return height < 540;
  });

  useEffect(() => {
    const root = document.documentElement;

    const updateViewportMetrics = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      root.style.setProperty('--efer-app-height', `${Math.round(height)}px`);
      setIsCompactHeight(height < 540);

      if (vv && vv.offsetTop > 0) {
        window.scrollTo(0, 0);
      }
    };

    updateViewportMetrics();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', updateViewportMetrics);
      vv.addEventListener('scroll', updateViewportMetrics);
    }
    window.addEventListener('resize', updateViewportMetrics);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateViewportMetrics);
        vv.removeEventListener('scroll', updateViewportMetrics);
      }
      window.removeEventListener('resize', updateViewportMetrics);
      root.style.removeProperty('--efer-app-height');
    };
  }, []);

  return { isCompactHeight };
}
