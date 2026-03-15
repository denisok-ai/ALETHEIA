/**
 * Генерация PDF сертификатов в стиле сайта AVATERRA.
 * Цвета: primary #2D1B4E, secondary #D4AF37, dark #0A0E27.
 * Шаблоны: default (бренд), minimal (лаконичный), elegant (рамка).
 * Шрифт с поддержкой кириллицы (Noto Sans) — иначе русский текст отображается как «кракозябры».
 * В Node.js загрузка по URL не работает, используем локальный файл из @fontsource/noto-sans.
 */
import path from 'path';
import { existsSync } from 'fs';
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';

const notoSansPath = path.join(
  process.cwd(),
  'node_modules',
  '@fontsource',
  'noto-sans',
  'files',
  'noto-sans-cyrillic-400-normal.woff'
);

let FONT_FAMILY_FALLBACK = 'Helvetica';
if (existsSync(notoSansPath)) {
  try {
    Font.register({ family: 'NotoSans', src: notoSansPath });
    FONT_FAMILY_FALLBACK = 'NotoSans';
  } catch {
    // оставляем Helvetica
  }
}

const COLORS = {
  primary: '#2D1B4E',
  secondary: '#D4AF37',
  dark: '#0A0E27',
  cream: '#f5f2ec',
  white: '#ffffff',
  muted: '#5c5854',
} as const;

const FONT_FAMILY = FONT_FAMILY_FALLBACK;

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: FONT_FAMILY,
    backgroundColor: COLORS.white,
  },
  pageCream: {
    padding: 0,
    fontFamily: FONT_FAMILY,
    backgroundColor: COLORS.cream,
  },
  // —— шаблон default (avaterra) ——
  defaultHeader: {
    backgroundColor: COLORS.primary,
    paddingVertical: 28,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  defaultTitle: {
    fontSize: 28,
    color: COLORS.white,
    letterSpacing: 2,
    marginBottom: 4,
  },
  defaultSubtitle: {
    fontSize: 11,
    color: COLORS.secondary,
    letterSpacing: 1,
  },
  defaultLine: {
    height: 3,
    width: 120,
    backgroundColor: COLORS.secondary,
    marginTop: 24,
    marginBottom: 0,
  },
  defaultBody: {
    paddingHorizontal: 48,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'center',
  },
  defaultLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  defaultName: {
    fontSize: 22,
    color: COLORS.dark,
    marginBottom: 16,
    textAlign: 'center',
  },
  defaultCourseLine: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 6,
    textAlign: 'center',
  },
  defaultCourseName: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  defaultFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e8e4de',
    paddingTop: 16,
    paddingHorizontal: 48,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defaultNumber: {
    fontSize: 10,
    color: COLORS.muted,
  },
  defaultDate: {
    fontSize: 10,
    color: COLORS.muted,
  },
  // —— шаблон minimal ——
  minimalWrap: {
    padding: 56,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimalTitle: {
    fontSize: 20,
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 6,
  },
  minimalSubtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 40,
  },
  minimalName: {
    fontSize: 24,
    color: COLORS.dark,
    marginBottom: 12,
  },
  minimalCourse: {
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 36,
  },
  minimalDivider: {
    width: 80,
    height: 2,
    backgroundColor: COLORS.secondary,
    marginBottom: 24,
  },
  minimalMeta: {
    fontSize: 10,
    color: COLORS.muted,
  },
  // —— шаблон elegant (рамка) ——
  elegantBorder: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  elegantInner: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 40,
    borderWidth: 1,
    borderColor: COLORS.primary,
    opacity: 0.4,
  },
  elegantContent: {
    padding: 72,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elegantTitle: {
    fontSize: 26,
    color: COLORS.primary,
    letterSpacing: 3,
    marginBottom: 8,
  },
  elegantSubtitle: {
    fontSize: 11,
    color: COLORS.secondary,
    marginBottom: 36,
  },
  elegantName: {
    fontSize: 20,
    color: COLORS.dark,
    marginBottom: 12,
  },
  elegantCourse: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 8,
  },
  elegantCourseName: {
    fontSize: 15,
    color: COLORS.primary,
    marginBottom: 28,
  },
  elegantFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary,
  },
  elegantMeta: {
    fontSize: 9,
    color: COLORS.muted,
  },
});

import {
  type CertificateTemplateId,
  CERTIFICATE_TEMPLATE_IDS,
  CERTIFICATE_TEMPLATE_LABELS,
} from './certificates-constants';

export type { CertificateTemplateId };
export { CERTIFICATE_TEMPLATE_IDS, CERTIFICATE_TEMPLATE_LABELS };

export interface CertificateData {
  userName: string;
  courseName: string;
  certNumber: string;
  date: string;
}

/** Координаты полей для наложения текста на подложку (x, y в pt; опционально fontSize). */
export interface CertificateTextMapping {
  name?: { x: number; y: number; fontSize?: number };
  date?: { x: number; y: number; fontSize?: number };
  courseTitle?: { x: number; y: number; fontSize?: number };
  certNumber?: { x: number; y: number; fontSize?: number };
}

function CertificateDefault({ data }: { data: CertificateData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.defaultHeader}>
        <Text style={styles.defaultTitle}>AVATERRA</Text>
        <Text style={styles.defaultSubtitle}>Phygital школа мышечного тестирования</Text>
      </View>
      <View style={styles.defaultLine} />
      <View style={styles.defaultBody}>
        <Text style={styles.defaultLabel}>Подтверждает, что</Text>
        <Text style={styles.defaultName}>{data.userName}</Text>
        <Text style={styles.defaultCourseLine}>успешно прошёл(ла) курс</Text>
        <Text style={styles.defaultCourseName}>{data.courseName}</Text>
      </View>
      <View style={styles.defaultFooter}>
        <Text style={styles.defaultNumber}>Сертификат № {data.certNumber}</Text>
        <Text style={styles.defaultDate}>{data.date}</Text>
      </View>
    </Page>
  );
}

function CertificateMinimal({ data }: { data: CertificateData }) {
  return (
    <Page size="A4" style={styles.pageCream}>
      <View style={styles.minimalWrap}>
        <Text style={styles.minimalTitle}>AVATERRA</Text>
        <Text style={styles.minimalSubtitle}>Phygital школа мышечного тестирования</Text>
        <View style={styles.minimalDivider} />
        <Text style={styles.minimalName}>{data.userName}</Text>
        <Text style={styles.minimalCourse}>{data.courseName}</Text>
        <Text style={styles.minimalMeta}>Сертификат № {data.certNumber} · {data.date}</Text>
      </View>
    </Page>
  );
}

function CertificateElegant({ data }: { data: CertificateData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.elegantBorder} />
      <View style={styles.elegantInner} />
      <View style={styles.elegantContent}>
        <Text style={styles.elegantTitle}>AVATERRA</Text>
        <Text style={styles.elegantSubtitle}>Phygital школа мышечного тестирования</Text>
        <Text style={styles.elegantName}>{data.userName}</Text>
        <Text style={styles.elegantCourse}>успешно прошёл(ла) курс</Text>
        <Text style={styles.elegantCourseName}>{data.courseName}</Text>
        <View style={styles.elegantFooter}>
          <Text style={styles.elegantMeta}>№ {data.certNumber}</Text>
          <Text style={styles.elegantMeta}>{data.date}</Text>
        </View>
      </View>
    </Page>
  );
}

function pickTemplate(templateId: CertificateTemplateId, data: CertificateData): React.ReactElement {
  switch (templateId) {
    case 'minimal':
      return <CertificateMinimal data={data} />;
    case 'elegant':
      return <CertificateElegant data={data} />;
    default:
      return <CertificateDefault data={data} />;
  }
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

function textStyle(m: { x: number; y: number; fontSize?: number }, defaultSize: number) {
  return {
    position: 'absolute' as const,
    left: m.x,
    top: m.y,
    fontSize: m.fontSize ?? defaultSize,
    fontFamily: FONT_FAMILY,
    color: COLORS.dark,
  };
}

function CertificateFromImage({
  data,
  backgroundSrc,
  mapping,
}: {
  data: CertificateData;
  backgroundSrc: string;
  mapping: CertificateTextMapping;
}) {
  return (
    <Page size="A4" style={{ padding: 0, fontFamily: FONT_FAMILY }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image from @react-pdf/renderer has no alt prop */}
      <Image
        src={backgroundSrc}
        style={{ position: 'absolute', top: 0, left: 0, width: A4_WIDTH, height: A4_HEIGHT }}
      />
      {mapping.name && <Text style={textStyle(mapping.name, 16)}>{data.userName}</Text>}
      {mapping.date && <Text style={textStyle(mapping.date, 10)}>{data.date}</Text>}
      {mapping.courseTitle && <Text style={textStyle(mapping.courseTitle, 14)}>{data.courseName}</Text>}
      {mapping.certNumber && <Text style={textStyle(mapping.certNumber, 10)}>{data.certNumber}</Text>}
    </Page>
  );
}

/**
 * Генерирует PDF по подложке (образу) и textMapping.
 * @param data — данные для сертификата
 * @param backgroundImagePath — абсолютный путь к файлу подложки (PNG/PDF) или URL
 * @param textMapping — координаты полей (name, date, courseTitle, certNumber)
 */
export async function generateCertificatePdfWithImage(
  data: CertificateData,
  backgroundImagePath: string,
  textMapping: CertificateTextMapping
): Promise<Buffer> {
  const doc = (
    <Document>
      <CertificateFromImage data={data} backgroundSrc={backgroundImagePath} mapping={textMapping} />
    </Document>
  );
  const result = await renderToBuffer(doc);
  return Buffer.isBuffer(result) ? result : Buffer.from(result as ArrayBuffer);
}

/**
 * Генерирует PDF сертификата в стиле сайта.
 * @param data — данные для сертификата
 * @param templateId — идентификатор шаблона: default (основной), minimal, elegant
 */
export async function generateCertificatePdf(
  data: CertificateData,
  templateId: CertificateTemplateId = 'default'
): Promise<Buffer> {
  const doc = (
    <Document>
      {pickTemplate(templateId, data)}
    </Document>
  );
  const result = await renderToBuffer(doc);
  return Buffer.isBuffer(result) ? result : Buffer.from(result as ArrayBuffer);
}
