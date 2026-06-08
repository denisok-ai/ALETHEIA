/**
 * Пути кеша PDF сертификатов: версия макета + встроенный layout, чтобы не отдавать старый файл
 * и чтобы разные ?template= кешировались раздельно.
 */
import { parseCertificateTemplateJson } from './certificate-template-text-mapping';
import { CERTIFICATE_TEMPLATE_IDS, type CertificateTemplateId } from './certificates-constants';

/** Увеличить при смене дизайна PDF — старые файлы перестанут подхватываться */
export const CERTIFICATE_PDF_CACHE_VERSION = '6';

export function parseCertificateLayoutQuery(param: string | null): CertificateTemplateId {
  if (param && CERTIFICATE_TEMPLATE_IDS.includes(param as CertificateTemplateId)) {
    return param as CertificateTemplateId;
  }
  return 'default';
}

/**
 * Макет встроенного PDF: явный ?template= (кроме default) — приоритет;
 * иначе pdfLayout из JSON шаблона; иначе default.
 */
export function resolveCertificateBuiltinLayout(
  templateQuery: string | null,
  templateTextMappingJson: string | null
): CertificateTemplateId {
  const q = templateQuery?.trim();
  if (q && q !== 'default') {
    return parseCertificateLayoutQuery(q);
  }
  const { pdfLayout } = parseCertificateTemplateJson(templateTextMappingJson);
  return pdfLayout ?? 'default';
}

/** Встроенный макет (без подложки из БД) */
export function builtinPdfStoragePath(certId: string, layoutId: CertificateTemplateId): string {
  return `uploads/certificates/${certId}/v${CERTIFICATE_PDF_CACHE_VERSION}-${layoutId}.pdf`;
}

/** Подложка из шаблона (backgroundImageUrl) */
export function customBgPdfStoragePath(certId: string): string {
  return `uploads/certificates/${certId}/v${CERTIFICATE_PDF_CACHE_VERSION}-bg.pdf`;
}
