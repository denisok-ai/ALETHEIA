/**
 * Пути кеша PDF сертификатов: версия макета + встроенный layout, чтобы не отдавать старый файл
 * и чтобы разные ?template= кешировались раздельно.
 */
import { CERTIFICATE_TEMPLATE_IDS, type CertificateTemplateId } from './certificates-constants';

/** Увеличить при смене дизайна PDF — старые файлы перестанут подхватываться */
export const CERTIFICATE_PDF_CACHE_VERSION = '2';

export function parseCertificateLayoutQuery(param: string | null): CertificateTemplateId {
  if (param && CERTIFICATE_TEMPLATE_IDS.includes(param as CertificateTemplateId)) {
    return param as CertificateTemplateId;
  }
  return 'default';
}

/** Встроенный макет (без подложки из БД) */
export function builtinPdfStoragePath(certId: string, layoutId: CertificateTemplateId): string {
  return `uploads/certificates/${certId}/v${CERTIFICATE_PDF_CACHE_VERSION}-${layoutId}.pdf`;
}

/** Подложка из шаблона (backgroundImageUrl) */
export function customBgPdfStoragePath(certId: string): string {
  return `uploads/certificates/${certId}/v${CERTIFICATE_PDF_CACHE_VERSION}-bg.pdf`;
}
