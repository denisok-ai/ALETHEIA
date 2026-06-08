/**
 * Константы и типы для сертификатов (без зависимостей от Node.js).
 * Импортировать в клиентских компонентах; генерация PDF — в lib/certificates.tsx (только сервер).
 *
 * Визуал в палитре сайта (plum / rose / lavender). default и heritage — классика с рамкой;
 * prestige — шапка plum и акцент rose; minimal и elegant — лаконичные варианты.
 */
export type CertificateTemplateId =
  | 'default'
  | 'heritage'
  | 'prestige'
  | 'minimal'
  | 'elegant'
  /** Витрина: тело, тестирование, «код тела» — сильный визуал для соцсетей */
  | 'vitality'
  /** Витрина: пробуждение, движение, тёплый свет */
  | 'awaken'
  /** Витрина: первый шаг / пробный — дружелюбный «вход» в школу */
  | 'path';

export const CERTIFICATE_TEMPLATE_IDS: CertificateTemplateId[] = [
  'default',
  'heritage',
  'prestige',
  'minimal',
  'elegant',
  'vitality',
  'awaken',
  'path',
];

export const CERTIFICATE_TEMPLATE_LABELS: Record<CertificateTemplateId, string> = {
  default: 'Классика — золотая обводка, линейный фон',
  heritage: 'Классика — как основной, для превью печати',
  prestige: 'Премиум — светлая шапка, золотые акценты, без заливки фона',
  minimal: 'Минимализм — центр, сетка из контурных точек',
  elegant: 'Элегант — двойная рамка, белый блок, розетки-обводки',
  vitality: 'Витальность — тело и тестирование (для стены и соцсетей)',
  awaken: 'Пробуждение — свет и движение (витрина курса)',
  path: 'Первый шаг — мягкий «вход» в практику',
};

/** Шаблоны для выпадающего списка скачивания (без дубля default/heritage). */
export const CERTIFICATE_TEMPLATE_IDS_FOR_SELECT: CertificateTemplateId[] = [
  'default',
  'prestige',
  'minimal',
  'elegant',
  'vitality',
  'awaken',
  'path',
];
