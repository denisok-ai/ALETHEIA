'use client';

/**
 * Вызывает API claim-orders при первом входе студента в портал.
 * Cookie avaterra_claim_checked ограничивает частоту (1 день).
 */
import { useEffect, useRef } from 'react';

export function ClaimOrdersTrigger() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fetch('/api/portal/claim-orders', { credentials: 'include' }).catch(() => {});
  }, []);
  return null;
}
