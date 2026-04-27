'use client';

/**
 * Client-only bundle for media viewer (PDF.js worker, Plyr).
 */
import dynamic from 'next/dynamic';

const MediaViewer = dynamic(() => import('./MediaViewer'), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-[var(--portal-text-muted)] py-6 text-center">Загрузка просмотрщика…</p>
  ),
});

export default MediaViewer;
