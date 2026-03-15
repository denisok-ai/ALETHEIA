/**
 * Download certificate PDF. User must own the certificate.
 * Если у сертификата есть шаблон с подложкой (backgroundImageUrl) — PDF по подложке и textMapping; иначе — макет default/minimal/elegant.
 * Если allowUserDownload=false — обычный пользователь получает 403; админ — разрешено.
 */
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, requireAdminSession } from '@/lib/auth';
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
  const { certId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cert = await prisma.certificate.findFirst({
    where: { id: certId, userId, revokedAt: null },
    include: {
      course: { select: { title: true } },
      template: { select: { backgroundImageUrl: true, textMapping: true, allowUserDownload: true } },
    },
  });

  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

  const admin = await requireAdminSession();
  if (!admin && cert.template?.allowUserDownload === false) {
    return NextResponse.json({ error: 'Скачивание электронной версии для этого сертификата недоступно' }, { status: 403 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { displayName: true },
  });
  const displayName = profile?.displayName ?? (session?.user?.email ?? 'Слушатель');

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
    // кеш не критичен
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${cert.certNumber}.pdf"`,
    },
  });
}
