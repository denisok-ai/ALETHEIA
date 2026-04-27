/**
 * Админ: демо-PDF встроенного макета для просмотра в браузере (inline).
 * GET ?template=default|heritage|prestige|minimal|elegant
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { generateCertificatePdf } from '@/lib/certificates';
import { CERTIFICATE_SAMPLE_DEMO } from '@/lib/certificate-sample-demo';
import { parseCertificateLayoutQuery } from '@/lib/certificate-pdf-cache';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const layoutId = parseCertificateLayoutQuery(request.nextUrl.searchParams.get('template'));

  const buffer = await generateCertificatePdf(CERTIFICATE_SAMPLE_DEMO, layoutId);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sample-certificate-${layoutId}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
