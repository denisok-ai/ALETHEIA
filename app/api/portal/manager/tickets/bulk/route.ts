/**
 * Manager: bulk update ticket status (and optionally assign manager).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireManagerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ALLOWED_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const MAX_IDS = 100;

export async function POST(request: NextRequest) {
  const auth = await requireManagerSession();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { ticketIds?: unknown; status?: string; managerId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ids = Array.isArray(body.ticketIds)
    ? body.ticketIds.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, MAX_IDS)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ticketIds required' }, { status: 400 });
  }

  const data: { status?: string; managerId?: string | null } = {};
  if (typeof body.status === 'string' && ALLOWED_STATUSES.includes(body.status)) {
    data.status = body.status;
  }
  if (body.managerId !== undefined) {
    data.managerId = body.managerId === '' || body.managerId === null ? null : String(body.managerId);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 });
  }

  const result = await prisma.ticket.updateMany({
    where: { id: { in: ids } },
    data,
  });

  return NextResponse.json({ updated: result.count });
}
