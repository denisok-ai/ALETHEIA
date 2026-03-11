/**
 * Admin: delete a saved LLM API key. LlmSettings referencing it will have apiKeyId set to null.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await prisma.llmApiKey.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
