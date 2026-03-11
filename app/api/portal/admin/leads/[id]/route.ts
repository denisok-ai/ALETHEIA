/**
 * Admin: update lead (status).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ALLOWED_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const MAX_NOTES = 2000;
const MAX_SOURCE = 100;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { status?: string; notes?: string | null; source?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: { status?: string; notes?: string | null; source?: string | null } = {};
  const status = body.status?.trim();
  if (status && ALLOWED_STATUSES.includes(status)) data.status = status;
  if (body.notes !== undefined) {
    const v = body.notes === '' ? null : String(body.notes).trim().slice(0, MAX_NOTES) || null;
    data.notes = v;
  }
  if (body.source !== undefined) {
    const v = body.source === '' ? null : String(body.source).trim().slice(0, MAX_SOURCE) || null;
    data.source = v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 });
  }

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data,
  });
  return NextResponse.json({ lead });
}
