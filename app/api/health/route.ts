/**
 * Health check for load balancers and monitoring.
 * GET /api/health — 200 если процесс отвечает и SQLite (Prisma) доступен; 503 если БД недоступна.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { APP_VERSION } from '@/lib/app-version';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = APP_VERSION;
  const commit =
    process.env.NEXT_PUBLIC_BUILD_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    null;

  let databaseOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch (e) {
    console.error('[health] database check failed:', e);
  }

  const ok = databaseOk;
  const status = ok ? 200 : 503;

  return NextResponse.json(
    {
      ok,
      version,
      commit,
      database: databaseOk ? 'ok' : 'error',
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        ...(version ? { 'X-App-Version': String(version) } : {}),
        ...(commit ? { 'X-Build-Commit': String(commit) } : {}),
      },
    },
  );
}
