/**
 * Health check for load balancers and monitoring.
 * GET /api/health — 200 если процесс отвечает и SQLite (Prisma) доступен; 503 если БД недоступна.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? null;
  const commit =
    process.env.NEXT_PUBLIC_BUILD_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    null;

  let databaseOk = false;
  let databaseMessage: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseOk = true;
  } catch (e) {
    databaseMessage = e instanceof Error ? e.message : 'database_unreachable';
  }

  const ok = databaseOk;
  const status = ok ? 200 : 503;

  return NextResponse.json(
    {
      ok,
      version,
      commit,
      database: databaseOk ? 'ok' : 'error',
      ...(databaseMessage ? { databaseError: databaseMessage } : {}),
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
