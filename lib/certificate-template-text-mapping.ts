/**
 * Разбор textMapping шаблона сертификата: опционально pdfLayout для встроенного PDF без подложки.
 */
import { CERTIFICATE_TEMPLATE_IDS, type CertificateTemplateId } from './certificates-constants';

export function parseCertificateTemplateJson(raw: string | null): {
  pdfLayout: CertificateTemplateId | null;
  /** Поля для наложения на картинку-подложку (без pdfLayout) */
  rest: Record<string, unknown>;
} {
  if (!raw?.trim()) return { pdfLayout: null, rest: {} };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const pl = obj.pdfLayout;
    const pdfLayout =
      typeof pl === 'string' && CERTIFICATE_TEMPLATE_IDS.includes(pl as CertificateTemplateId)
        ? (pl as CertificateTemplateId)
        : null;
    const { pdfLayout: _omit, ...rest } = obj;
    return { pdfLayout, rest };
  } catch {
    return { pdfLayout: null, rest: {} };
  }
}
