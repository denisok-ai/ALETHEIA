/**
 * Журнал фиксации согласий на обработку ПДн (доказательная база).
 */
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

export const PDN_DOCS_VERSION = '2026-04-30';

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 48);
}

async function getClientMeta(): Promise<{ ipHash: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = fwd || h.get('x-real-ip') || null;
    const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;
    return { ipHash: hashIp(ip), userAgent };
  } catch {
    return { ipHash: null, userAgent: null };
  }
}

export async function logPersonalDataConsent(input: {
  kind: string;
  context: string;
  userId?: string | null;
  emailNorm?: string | null;
  orderNumber?: string | null;
}): Promise<void> {
  const { ipHash, userAgent } = await getClientMeta();
  try {
    await prisma.consentLog.create({
      data: {
        kind: input.kind,
        context: input.context,
        userId: input.userId ?? null,
        emailNorm: input.emailNorm ?? null,
        orderNumber: input.orderNumber ?? null,
        docVersion: PDN_DOCS_VERSION,
        ipHash,
        userAgent,
      },
    });
  } catch (e) {
    console.error('[consent-log]', e);
  }
}
