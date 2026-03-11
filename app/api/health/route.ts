/**
 * Health check for load balancers and monitoring.
 * GET /api/health — returns 200 when the app is up.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
