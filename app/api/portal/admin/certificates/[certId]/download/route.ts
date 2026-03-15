/**
 * Admin: download any certificate PDF.
 * Если у сертификата есть pdfUrl и файл в кеше — отдаём из кеша; иначе генерируем, кешируем и отдаём.
 * Query: ?template=default|minimal|elegant — шаблон в стиле сайта (если образ не задан).
 */
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { storageRead, storageWrite, storageExists } from '@/lib/storage';
import {
  generateCertificatePdf,
  generateCertificatePdfWithImage,
  CERTIFICATE_TEMPLATE_IDS,
  type CertificateTemplateId,
  type CertificateTextMapping,
} from '@/lib/certificates';

function resolveBackgroundPath(backgroundImageUrl: string): string {
  const relative = backgroundImageUrl.startsWith('/') ? backgroundImageUrl.slice(1) : backgroundImageUrl;
  return path.join(process.cwd(), 'public', relative);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { certId } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { id: certId },
    include: {
      course: { select: { title: true } },
      template: { select: { backgroundImageUrl: true, textMapping: true } },
    },
  });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (cert.revokedAt) return NextResponse.json({ error: 'Сертификат аннулирован' }, { status: 403 });

  const cachePath = cert.pdfUrl && !cert.pdfUrl.startsWith('http') ? cert.pdfUrl : null;
  if (cachePath && storageExists(cachePath)) {
    const cached = await storageRead(cachePath);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="certificate-${cert.certNumber}.pdf"`,
        },
      });
    }
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: cert.userId },
    select: { displayName: true },
  });
  const displayName = profile?.displayName ?? 'Слушатель';

  const data = {
    userName: displayName,
    courseName: cert.course?.title ?? 'Курс',
    certNumber: cert.certNumber,
    date: new Date(cert.issuedAt).toLocaleDateString('ru'),
  };

  let buffer: Buffer;
  const template = cert.template;
  if (template?.backgroundImageUrl) {
    const backgroundPath = resolveBackgroundPath(template.backgroundImageUrl);
    let mapping: CertificateTextMapping = {};
    if (template.textMapping) {
      try {
        mapping = JSON.parse(template.textMapping) as CertificateTextMapping;
      } catch {
        // оставляем пустой mapping
      }
    }
    buffer = await generateCertificatePdfWithImage(data, backgroundPath, mapping);
  } else {
    const templateParam = request.nextUrl.searchParams.get('template');
    const template: CertificateTemplateId =
      templateParam && CERTIFICATE_TEMPLATE_IDS.includes(templateParam as CertificateTemplateId)
        ? (templateParam as CertificateTemplateId)
        : 'default';
    buffer = await generateCertificatePdf(data, template);
  }

  const certCachePath = `uploads/certificates/${certId}.pdf`;
  try {
    await storageWrite(certCachePath, buffer);
    await prisma.certificate.update({
      where: { id: certId },
      data: { pdfUrl: certCachePath },
    });
  } catch {
    // кеш не критичен, отдаём сгенерированный PDF
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${cert.certNumber}.pdf"`,
    },
  });
}
