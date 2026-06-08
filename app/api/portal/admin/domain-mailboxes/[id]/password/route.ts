/**
 * Admin: смена пароля доменного ящика (шифр в БД + Mailcow при режиме mailcow).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { writeAuditLog } from '@/lib/audit';
import { changeDomainMailboxPassword } from '@/lib/domain-mailbox-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const result = await changeDomainMailboxPassword({
    domainMailboxId: id,
    newPassword: password,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Ошибка' }, { status: 400 });
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: 'domain_mailbox_password_change',
    entity: 'DomainMailbox',
    entityId: id,
    diff: null,
  });

  return NextResponse.json({ ok: true });
}
