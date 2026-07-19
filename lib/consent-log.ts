/**
 * Журнал фиксации согласий на обработку ПДн (доказательная база).
 */
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { clientIpFromHeaders } from '@/lib/client-ip';

export const PDN_DOCS_VERSION = '2026-04-30';

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 48);
}

async function getClientMeta(): Promise<{ ipHash: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    // Подделанный клиентом IP не должен попадать в журнал согласий — см. lib/client-ip.ts
    const ip = clientIpFromHeaders((n) => h.get(n));
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
