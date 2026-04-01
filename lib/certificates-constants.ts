/**
 * Константы и типы для сертификатов (без зависимостей от Node.js).
 * Импортировать в клиентских компонентах; генерация PDF — в lib/certificates.tsx (только сервер).
 *
 * Макеты: default и heritage — «Классика» (рамка, логотип); prestige — «Премиум» (тёмная шапка);
 * minimal / elegant — компактные варианты.
 */
export type CertificateTemplateId = 'default' | 'heritage' | 'prestige' | 'minimal' | 'elegant';

export const CERTIFICATE_TEMPLATE_IDS: CertificateTemplateId[] = [
  'default',
  'heritage',
  'prestige',
  'minimal',
  'elegant',
];

export const CERTIFICATE_TEMPLATE_LABELS: Record<CertificateTemplateId, string> = {
  default: 'Основной (классика, рамка)',
  heritage: 'Классика — рамка и логотип',
  prestige: 'Премиум — тёмная шапка',
  minimal: 'Компактный',
  elegant: 'С двойной рамкой',
};

/** Шаблоны для выпадающего списка скачивания (без дубля default/heritage). */
export const CERTIFICATE_TEMPLATE_IDS_FOR_SELECT: CertificateTemplateId[] = [
  'default',
  'prestige',
  'minimal',
  'elegant',
];
