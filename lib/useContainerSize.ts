'use client';

import { useRef, useState, useEffect } from 'react';

export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      setReady(true);
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setReady(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, ready };
}
