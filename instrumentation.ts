/**
 * Старт Node-процесса: NEXTAUTH_URL из site_url в БД (без getSystemSettings/React cache — безопасно в register()).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { applyNextAuthUrlFromDatabaseStartup } = await import('@/lib/settings');
    await applyNextAuthUrlFromDatabaseStartup();
  } catch {
    /* ignore */
  }
}
