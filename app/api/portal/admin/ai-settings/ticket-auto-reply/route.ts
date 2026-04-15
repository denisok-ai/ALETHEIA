/**
 * Admin: get/set ticket auto-reply on creation (ticket_auto_reply_enabled).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const row = await prisma.systemSetting.findUnique({
    where: { key: 'ticket_auto_reply_enabled' },
  });
  const enabled = row?.value === 'true' || row?.value === '1';
  return NextResponse.json({ enabled });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const enabled = body.enabled === true;
  await prisma.systemSetting.upsert({
    where: { key: 'ticket_auto_reply_enabled' },
    create: { key: 'ticket_auto_reply_enabled', value: enabled ? 'true' : 'false', updatedAt: new Date() },
    update: { value: enabled ? 'true' : 'false', updatedAt: new Date() },
  });
  return NextResponse.json({ enabled });
}
