'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Готовность контейнера графика: recharts ResponsiveContainer с нулевыми
 * размерами рисует пустоту, поэтому график монтируем только когда у
 * контейнера появились ширина и высота.
 *
 * Callback-ref, а не useRef + эффект с []: контейнер часто появляется позже
 * первого рендера (сначала «нет данных», потом пользователь переключил
 * период) — одноразовый замер при монтировании такой контейнер не видел, и
 * график не рисовался до перезагрузки страницы.
 */
export function useContainerSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [ready, setReady] = useState(false);
  const ref = useCallback((node: T | null) => setEl(node), []);

  useEffect(() => {
    if (!el) {
      setReady(false);
      return;
    }
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
  }, [el]);

  return { ref, ready };
}
