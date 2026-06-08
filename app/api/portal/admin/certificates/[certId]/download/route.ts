/**
 * Admin: download any certificate PDF.
 * Кеш: отдельный файл на макет (v2-{layout}) или v2-bg для подложки — старый uploads/.../id.pdf не используется.
 * Query: ?template=… — макет PDF (если подложка не задана); иначе из JSON шаблона поле pdfLayout.
 */
import path from 'path';
import { existsSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
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
  resolveCertificateBuiltinLayout,
} from '@/lib/certificate-pdf-cache';
import { parseCertificateTemplateJson } from '@/lib/certificate-template-text-mapping';
import { resolveCertificateRecipientName } from '@/lib/certificate-recipient-name';

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
    select: {
      id: true,
      userId: true,
      certNumber: true,
      issuedAt: true,
      expiryDate: true,
      pdfUrl: true,
      revokedAt: true,
      course: { select: { title: true } },
      template: { select: { backgroundImageUrl: true, textMapping: true } },
    },
  });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (cert.revokedAt) return NextResponse.json({ error: 'Сертификат аннулирован' }, { status: 403 });

  const certTemplate = cert.template;
  const usesCustomBg = Boolean(certTemplate?.backgroundImageUrl);
  const builtinLayout = resolveCertificateBuiltinLayout(
    request.nextUrl.searchParams.get('template'),
    certTemplate?.textMapping ?? null
  );

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
    where: { id: cert.userId },
    select: {
      email: true,
      displayName: true,
      profile: { select: { displayName: true } },
    },
  });
  const recipientName = resolveCertificateRecipientName({
    profileDisplayName: owner?.profile?.displayName,
    userDisplayName: owner?.displayName,
    userEmail: owner?.email,
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
    if (existsSync(backgroundPath)) {
      let mapping: CertificateTextMapping = {};
      if (certTemplate.textMapping) {
        const { rest } = parseCertificateTemplateJson(certTemplate.textMapping);
        mapping = rest as CertificateTextMapping;
      }
      buffer = await generateCertificatePdfWithImage(data, backgroundPath, mapping);
    } else {
      buffer = await generateCertificatePdf(data, builtinLayout);
    }
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
