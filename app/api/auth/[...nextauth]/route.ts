import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getSystemSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const handler = NextAuth(authOptions);

type AuthRouteCtx = { params: Promise<{ nextauth: string[] }> | { nextauth: string[] } };

async function withNextAuthUrlFromDb(req: NextRequest, ctx: AuthRouteCtx) {
  await getSystemSettings();
  return handler(req, ctx);
}

export const GET = withNextAuthUrlFromDb;
export const POST = withNextAuthUrlFromDb;
