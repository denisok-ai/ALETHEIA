'use client';

/**
 * Версия и git-ревизия из next.config (NEXT_PUBLIC_*), чтобы на проде было видно, какая сборка отдана.
 */
export type PortalBuildBadgeVariant = 'main' | 'sidebar' | 'sidebar-collapsed';

export function PortalBuildBadge({ variant = 'main' }: { variant?: PortalBuildBadgeVariant }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '';
  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? '';
  const parts: string[] = [];
  if (version) parts.push(version.startsWith('v') ? version : `v${version}`);
  if (commit) parts.push(commit);
  const label = parts.length ? `Сборка ${parts.join(' · ')}` : '';
  const shortLabel =
    commit || (version ? (version.startsWith('v') ? version : `v${version}`) : '') || '—';
  if (parts.length === 0 && !version && !commit) {
    return (
      <p
        className="text-[10px] text-[var(--portal-text-muted)] opacity-80"
        title="Задайте BUILD_COMMIT при сборке или соберите в клоне с .git"
      >
        Сборка неизвестна
      </p>
    );
  }

  if (variant === 'sidebar-collapsed') {
    return (
      <p
        className="mx-auto max-w-[2.5rem] truncate text-center text-[9px] font-mono leading-tight text-[var(--portal-sidebar-label)] opacity-90"
        title={label || shortLabel}
        aria-label={label || shortLabel}
      >
        {shortLabel}
      </p>
    );
  }

  if (variant === 'sidebar') {
    return (
      <p
        className="break-all text-[10px] leading-snug text-[var(--portal-sidebar-label)] opacity-90"
        aria-label={label}
      >
        {label}
      </p>
    );
  }

  return (
    <p
      className="mt-8 shrink-0 border-t border-[#E2E8F0] pt-3 text-center text-[11px] text-[var(--portal-text-muted)] md:text-left"
      aria-label={label}
    >
      {label}
    </p>
  );
}
