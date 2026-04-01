/**
 * Админ: демо-PDF встроенного макета для просмотра в браузере (inline).
 * GET ?template=default|heritage|prestige|minimal|elegant
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { generateCertificatePdf } from '@/lib/certificates';
import { parseCertificateLayoutQuery } from '@/lib/certificate-pdf-cache';

const DEMO = {
  userName: 'Иванова Анна Сергеевна',
  courseName: 'Курс «Тело не врёт» — мышечное тестирование',
  certNumber: 'AVT-DEMO-2026',
  date: new Date().toLocaleDateString('ru'),
  expiryDate: null as string | null,
};

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const layoutId = parseCertificateLayoutQuery(request.nextUrl.searchParams.get('template'));

  const buffer = await generateCertificatePdf(DEMO, layoutId);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sample-certificate-${layoutId}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
