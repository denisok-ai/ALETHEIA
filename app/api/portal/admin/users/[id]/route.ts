/**
 * Admin: update user (role, status).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ALLOWED_ROLES = ['user', 'manager', 'admin'];
const ALLOWED_STATUSES = ['active', 'archived'];
const MAX_DISPLAY_NAME = 200;
const MAX_EMAIL = 255;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { role?: string; status?: string; displayName?: string | null; email?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const profileUpdates: { role?: string; status?: string; displayName?: string | null; email?: string | null } = {};
  if (body.role && ALLOWED_ROLES.includes(body.role)) profileUpdates.role = body.role;
  if (body.status && ALLOWED_STATUSES.includes(body.status)) profileUpdates.status = body.status;
  if (body.displayName !== undefined) {
    const v = body.displayName === '' ? null : (body.displayName ?? '').trim().slice(0, MAX_DISPLAY_NAME) || null;
    profileUpdates.displayName = v;
  }
  if (body.email !== undefined) {
    profileUpdates.email = body.email === '' ? null : (body.email ?? '').trim().slice(0, MAX_EMAIL) || null;
  }

  if (Object.keys(profileUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 });
  }

  const profile = await prisma.profile.update({
    where: { userId: id },
    data: profileUpdates,
  });
  return NextResponse.json({ profile });
}
