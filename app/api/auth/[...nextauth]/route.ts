import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const handler = NextAuth(authOptions);

type AuthRouteCtx = { params: Promise<{ nextauth: string[] }> | { nextauth: string[] } };

async function withNextAuthUrlFromDb(req: NextRequest, ctx: AuthRouteCtx) {
  if (req.method === 'POST') {
    const path = req.nextUrl.pathname;
    if (path.includes('/callback/credentials')) {
      const rateLimitRes = checkRateLimit(req, 'login', 10);
      if (rateLimitRes) return rateLimitRes;
    }
  }
  await getSystemSettings();
  return handler(req, ctx);
}

export const GET = withNextAuthUrlFromDb;
export const POST = withNextAuthUrlFromDb;
