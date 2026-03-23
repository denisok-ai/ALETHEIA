'use client';

/**
 * After deploy, cached HTML may reference old hashed chunks; dynamic import then fails
 * and Next shows a blank "client-side exception" screen. One hard reload usually fixes it.
 */
import { useEffect } from 'react';

const CHUNK_FAIL_RE =
  /Loading chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i;

const STORAGE_KEY = 'avaterra-chunk-reload-once';

export function ChunkLoadRecovery() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg =
        typeof reason === 'string'
          ? reason
          : reason && typeof reason.message === 'string'
            ? reason.message
            : String(reason);
      if (!CHUNK_FAIL_RE.test(msg)) return;
      e.preventDefault();
      if (typeof sessionStorage === 'undefined') {
        window.location.reload();
        return;
      }
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      sessionStorage.setItem(STORAGE_KEY, '1');
      window.location.reload();
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);
  return null;
}
