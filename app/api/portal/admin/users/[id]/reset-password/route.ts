/**
 * Admin: reset user password — generate temp password, hash, update User, audit log.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

const TEMP_PASSWORD_LENGTH = 12;

function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;
  if (!userId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'user.reset_password',
    entity: 'User',
    entityId: userId,
    diff: { targetEmail: user.email },
  });

  return NextResponse.json({
    success: true,
    tempPassword,
    message: 'Пароль сброшен. Передайте временный пароль пользователю (показывается один раз).',
  });
}
