/**
 * Download certificate PDF. User must own the certificate.
 * Кеш по версии и макету (см. lib/certificate-pdf-cache.ts), без старого единого id.pdf.
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
  type CertificateTextMapping,
} from '@/lib/certificates';
import {
  builtinPdfStoragePath,
  customBgPdfStoragePath,
  parseCertificateLayoutQuery,
} from '@/lib/certificate-pdf-cache';
import { resolveCertificateRecipientName } from '@/lib/certificate-recipient-name';

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
    select: {
      id: true,
      userId: true,
      certNumber: true,
      issuedAt: true,
      expiryDate: true,
      pdfUrl: true,
      revokedAt: true,
      course: { select: { title: true } },
      template: { select: { backgroundImageUrl: true, textMapping: true, allowUserDownload: true } },
    },
  });

  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = await requireAdminSession();
  if (!admin && cert.template?.allowUserDownload === false) {
    return NextResponse.json({ error: 'Скачивание электронной версии для этого сертификата недоступно' }, { status: 403 });
  }

  const certTemplate = cert.template;
  const usesCustomBg = Boolean(certTemplate?.backgroundImageUrl);
  const builtinLayout = parseCertificateLayoutQuery(request.nextUrl.searchParams.get('template'));

  const versionedCachePath = usesCustomBg
    ? customBgPdfStoragePath(certId)
    : builtinPdfStoragePath(certId, builtinLayout);

  if (storageExists(versionedCachePath)) {
    const cached = await storageRead(versionedCachePath);
    if (cached) {
      return new NextResponse(new Uint8Array(cached), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="certificate-${cert.certNumber}.pdf"`,
        },
      });
    }
  }

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      displayName: true,
      profile: { select: { displayName: true } },
    },
  });
  const recipientName = resolveCertificateRecipientName({
    profileDisplayName: owner?.profile?.displayName,
    userDisplayName: owner?.displayName,
    userEmail: owner?.email ?? (session?.user?.email ?? null),
  });

  const data = {
    userName: recipientName,
    courseName: cert.course?.title ?? 'Курс',
    certNumber: cert.certNumber,
    date: new Date(cert.issuedAt).toLocaleDateString('ru'),
    expiryDate: cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString('ru') : null,
  };

  let buffer: Buffer;
  if (certTemplate?.backgroundImageUrl) {
    const backgroundPath = resolveBackgroundPath(certTemplate.backgroundImageUrl);
    let mapping: CertificateTextMapping = {};
    if (certTemplate.textMapping) {
      try {
        mapping = JSON.parse(certTemplate.textMapping) as CertificateTextMapping;
      } catch {
        // пустой mapping
      }
    }
    buffer = await generateCertificatePdfWithImage(data, backgroundPath, mapping);
  } else {
    buffer = await generateCertificatePdf(data, builtinLayout);
  }

  try {
    await storageWrite(versionedCachePath, buffer);
    await prisma.certificate.update({
      where: { id: certId },
      data: { pdfUrl: versionedCachePath },
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
