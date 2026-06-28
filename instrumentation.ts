/**
 * Старт Node-процесса: NEXTAUTH_URL из site_url в БД; лог необработанных rejections.
 * Подавление шума от stale Server Action запросов (старые вкладки, боты).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const SA_NOISE = /Failed to find Server Action/;

  const origWrite = process.stdout.write;
  process.stdout.write = function (chunk: string | Uint8Array, ...args: unknown[]) {
    const str = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    if (SA_NOISE.test(str)) return true;
    return (origWrite as Function).call(process.stdout, chunk, ...args) as boolean;
  } as typeof process.stdout.write;

  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (SA_NOISE.test(msg)) return;
    console.error('[aletheia] unhandledRejection', reason);
  });

  try {
    const { applyNextAuthUrlFromDatabaseStartup } = await import('@/lib/settings-startup');
    await applyNextAuthUrlFromDatabaseStartup();
  } catch {
    /* ignore */
  }
}
