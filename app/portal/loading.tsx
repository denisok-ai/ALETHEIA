/**
 * Portal root loading — показывается при переходе на /portal до редиректа по роли.
 */
export default function PortalLoading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8" style={{ background: 'var(--portal-bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal-accent)] border-t-transparent" aria-hidden />
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
      </div>
    </div>
  );
}
