/** Типы данных сертификата и координат полей для макета с подложкой. */
import type { CertificateTemplateId } from '../certificates-constants';

export interface CertificateData {
  userName: string;
  courseName: string;
  certNumber: string;
  /** Дата выдачи (уже отформатированная, напр. ru-RU) */
  date: string;
  /** Подпись «Действителен до …»; null/undefined — не показывать */
  expiryDate?: string | null;
  /** Строка под логотипом; по умолчанию слоган школы */
  tagline?: string;
}

/** Координаты полей для наложения текста на подложку (x, y в pt; опционально fontSize). */
export interface CertificateTextMapping {
  /** Встроенный макет PDF (без картинки-подложки); задаётся в JSON шаблона в БД. */
  pdfLayout?: CertificateTemplateId;
  name?: { x: number; y: number; fontSize?: number };
  date?: { x: number; y: number; fontSize?: number };
  courseTitle?: { x: number; y: number; fontSize?: number };
  certNumber?: { x: number; y: number; fontSize?: number };
  expiryDate?: { x: number; y: number; fontSize?: number };
}
