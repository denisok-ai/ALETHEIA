'use client';

import dynamic from 'next/dynamic';

/**
 * Только на клиенте: Dialog + навигация — иначе при RSC возможен TypeError
 * «null (reading 'useContext')». Next 16 запрещает `ssr: false` в серверных
 * компонентах, поэтому обёртка клиентская.
 */
export const PortalCommandPaletteLazy = dynamic(
  () => import('@/components/portal/PortalCommandPalette').then((m) => ({ default: m.PortalCommandPalette })),
  { ssr: false }
);
