/**
 * Константы и типы для сертификатов (без зависимостей от Node.js).
 * Импортировать в клиентских компонентах; генерация PDF — в lib/certificates.tsx (только сервер).
 */
export type CertificateTemplateId = 'default' | 'minimal' | 'elegant';

export const CERTIFICATE_TEMPLATE_IDS: CertificateTemplateId[] = ['default', 'minimal', 'elegant'];

export const CERTIFICATE_TEMPLATE_LABELS: Record<CertificateTemplateId, string> = {
  default: 'AVATERRA (основной)',
  minimal: 'Лаконичный',
  elegant: 'С рамкой',
};
