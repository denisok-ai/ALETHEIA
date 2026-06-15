/**
 * Старт Node-процесса: NEXTAUTH_URL из site_url в БД; лог необработанных rejections.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  process.on('unhandledRejection', (reason) => {
    console.error('[aletheia] unhandledRejection', reason);
  });

  try {
    const { applyNextAuthUrlFromDatabaseStartup } = await import('@/lib/settings-startup');
    await applyNextAuthUrlFromDatabaseStartup();
  } catch {
    /* ignore */
  }

}
