/**
 * Health check for load balancers and monitoring.
 * GET /api/health — returns 200 when the app is up.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? null;
  const commit =
    process.env.NEXT_PUBLIC_BUILD_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    null;
  return NextResponse.json(
    {
      ok: true,
      version,
      commit,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        ...(version ? { 'X-App-Version': String(version) } : {}),
        ...(commit ? { 'X-Build-Commit': String(commit) } : {}),
      },
    },
  );
}
