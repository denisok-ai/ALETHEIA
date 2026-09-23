/**
 * PDF-сертификаты: каждый макет рендерится в валидный одностраничный PDF.
 * Страховка для lib/certificates (разбит на модули 23.09.2026 — тогда же
 * эквивалентность проверена побайтово по распакованным потокам pypdf).
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { CERTIFICATE_TEMPLATE_IDS, generateCertificatePdf, generateCertificatePdfWithImage } from '@/lib/certificates';

const data = {
  userName: 'Анна Смирнова',
  courseName: 'Навыки мышечного тестирования и работа с подсознанием',
  certNumber: 'AV-2026-00042',
  date: '23.09.2026',
};

function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe('certificates: генерация PDF', () => {
  it.each(CERTIFICATE_TEMPLATE_IDS)('макет %s — валидный PDF на одну страницу', async (id) => {
    const pdf = await generateCertificatePdf({ ...data, expiryDate: '23.09.2027' }, id);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(pageCount(pdf)).toBe(1);
  }, 30_000);

  it('макет с картинкой-подложкой и координатами полей', async () => {
    const bg = path.join(process.cwd(), 'public/images/icons/favicon-512.png');
    const pdf = await generateCertificatePdfWithImage(data, bg, {
      name: { x: 100, y: 200 },
      courseTitle: { x: 100, y: 230 },
      date: { x: 100, y: 260, fontSize: 12 },
      certNumber: { x: 100, y: 290 },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(pdf)).toBe(1);
  }, 30_000);
});
