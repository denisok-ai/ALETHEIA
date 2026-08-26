/**
 * Редирект по клику на оффер: отмечает `offerClickedAt` и уводит на страницу
 * тарифа. Публичный (человек кликает из Telegram), поэтому подпись обязательна —
 * иначе можно было бы накрутить чужие клики. Метка не блокирует переход: даже
 * при плохой подписи ведём на витрину, просто не засчитываем клик.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyOfferLink } from '@/lib/telegram-bot/offer-link';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/** slug из витрины — только безопасные символы, иначе на главную. */
function safeSlug(raw: string | null): string | null {
  if (!raw) return null;
  return /^[a-z0-9-]{1,64}$/i.test(raw) ? raw : null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const leadId = Number(url.searchParams.get('l'));
  const slug = safeSlug(url.searchParams.get('s'));
  const sig = url.searchParams.get('t') ?? '';

  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const dest = slug ? `${base}/services/${slug}` : base;

  if (Number.isInteger(leadId) && leadId > 0 && slug && verifyOfferLink(leadId, slug, sig)) {
    try {
      await prisma.lead.updateMany({
        where: { id: leadId, offerClickedAt: null },
        data: { offerClickedAt: new Date() },
      });
    } catch (e) {
      console.error('[r/offer] mark click:', e);
    }
  }

  return NextResponse.redirect(dest, 302);
}
