/**
 * Admin: convert lead to user — create User + Profile and link.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hash } from 'bcryptjs';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { leadId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const leadId = body.leadId;
  if (leadId == null) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (lead.convertedToUserId) {
    return NextResponse.json({ error: 'Lead already converted' }, { status: 400 });
  }

  const email = lead.email?.trim();
  if (!email) {
    return NextResponse.json({ error: 'Lead has no email. Add email to convert.' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { convertedToUserId: existingUser.id, status: 'converted' },
    });
    return NextResponse.json({ userId: existingUser.id, message: 'Linked to existing user' });
  }

  const password = nanoid(16);
  const passwordHash = await hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: lead.name,
    },
  });

  await prisma.profile.create({
    data: {
      id: `p-${user.id}`,
      userId: user.id,
      role: 'user',
      status: 'active',
      email: user.email,
      displayName: lead.name,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { convertedToUserId: user.id, status: 'converted' },
  });

  return NextResponse.json({
    userId: user.id,
    message: 'User created. Send password reset link to set password.',
  });
}
