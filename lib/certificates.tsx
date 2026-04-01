/**
 * Генерация PDF сертификатов в стиле сайта AVATERRA.
 * Цвета: primary #2D1B4E, secondary #D4AF37, dark #0A0E27.
 * Макеты: default/heritage — классика с логотипом и декоративной рамкой; prestige — премиум с тёмной шапкой;
 * minimal, elegant — компактные. Логотип: public/images/avaterra-logo.png.
 * Шрифт с кириллицей — Noto Sans 400/600 (@fontsource/noto-sans).
 */
import path from 'path';
import { existsSync } from 'fs';
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer';

const notoSans400 = path.join(
  process.cwd(),
  'node_modules',
  '@fontsource',
  'noto-sans',
  'files',
  'noto-sans-cyrillic-400-normal.woff'
);
const notoSans600 = path.join(
  process.cwd(),
  'node_modules',
  '@fontsource',
  'noto-sans',
  'files',
  'noto-sans-cyrillic-600-normal.woff'
);

let FONT_FAMILY_FALLBACK = 'Helvetica';
if (existsSync(notoSans400)) {
  try {
    const fonts: { src: string; fontWeight: number }[] = [{ src: notoSans400, fontWeight: 400 }];
    if (existsSync(notoSans600)) fonts.push({ src: notoSans600, fontWeight: 600 });
    Font.register({ family: 'NotoSans', fonts });
    FONT_FAMILY_FALLBACK = 'NotoSans';
  } catch {
    // Helvetica
  }
}

const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'avaterra-logo.png');
const LOGO_SRC = existsSync(LOGO_PATH) ? LOGO_PATH : null;

const COLORS = {
  primary: '#2D1B4E',
  secondary: '#D4AF37',
  dark: '#0A0E27',
  cream: '#f5f2ec',
  parchment: '#f7f4ee',
  white: '#ffffff',
  muted: '#5c5854',
  goldSoft: '#c9a227',
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
  // —— Классика (default / heritage) ——
  heritagePage: {
    backgroundColor: COLORS.parchment,
    fontFamily: FONT_FAMILY,
    padding: 0,
  },
  heritageOuterFrame: {
    position: 'absolute',
    top: 22,
    left: 22,
    right: 22,
    bottom: 22,
    borderWidth: 2.5,
    borderColor: COLORS.secondary,
  },
  heritageMidFrame: {
    position: 'absolute',
    top: 30,
    left: 30,
    right: 30,
    bottom: 30,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  heritageInnerFrame: {
    position: 'absolute',
    top: 38,
    left: 38,
    right: 38,
    bottom: 38,
    borderWidth: 0.5,
    borderColor: COLORS.goldSoft,
  },
  heritageCornerTL: {
    position: 'absolute',
    top: 44,
    left: 44,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.secondary,
  },
  heritageCornerTR: {
    position: 'absolute',
    top: 44,
    right: 44,
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.secondary,
  },
  heritageCornerBL: {
    position: 'absolute',
    bottom: 44,
    left: 44,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.secondary,
  },
  heritageCornerBR: {
    position: 'absolute',
    bottom: 44,
    right: 44,
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.secondary,
  },
  heritageBody: {
    flex: 1,
    paddingHorizontal: 52,
    paddingTop: 52,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heritageLogo: {
    width: 168,
    height: 52,
    objectFit: 'contain',
    marginBottom: 10,
  },
  heritageWordmark: {
    fontSize: 22,
    fontWeight: 600,
    color: COLORS.primary,
    letterSpacing: 3,
    marginBottom: 6,
  },
  heritageTagline: {
    fontSize: 9,
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 18,
    textAlign: 'center',
  },
  heritageCertLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    letterSpacing: 4,
    marginBottom: 6,
  },
  heritageTitle: {
    fontSize: 26,
    fontWeight: 600,
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  heritageHairline: {
    width: 100,
    height: 2,
    backgroundColor: COLORS.secondary,
    marginBottom: 22,
  },
  heritageLead: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  heritageName: {
    fontSize: 24,
    fontWeight: 600,
    color: COLORS.dark,
    textAlign: 'center',
    marginBottom: 14,
    maxWidth: 480,
  },
  heritageCourseHint: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 6,
    textAlign: 'center',
  },
  heritageCourse: {
    fontSize: 17,
    fontWeight: 600,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
    maxWidth: 480,
  },
  heritageGrow: {
    flexGrow: 1,
    minHeight: 24,
  },
  heritageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 420,
    borderTopWidth: 1,
    borderTopColor: '#dcd6cc',
    paddingTop: 14,
    marginTop: 8,
  },
  heritageMeta: {
    fontSize: 9,
    color: COLORS.muted,
  },
  heritageExpiry: {
    fontSize: 9,
    color: COLORS.primary,
    marginTop: 10,
    textAlign: 'center',
  },
  heritageSite: {
    fontSize: 8,
    color: COLORS.secondary,
    marginTop: 14,
    letterSpacing: 1,
  },
  // —— Премиум (prestige) ——
  prestigeHeader: {
    backgroundColor: COLORS.primary,
    paddingVertical: 20,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prestigeHeaderLogo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
  },
  prestigeHeaderWordmark: {
    fontSize: 16,
    fontWeight: 600,
    color: COLORS.white,
    letterSpacing: 2,
  },
  prestigeHeaderRight: {
    alignItems: 'flex-end',
  },
  prestigeHeaderCaption: {
    fontSize: 8,
    color: COLORS.secondary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  prestigeHeaderTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: COLORS.white,
    letterSpacing: 1,
  },
  prestigeGoldBar: {
    height: 4,
    backgroundColor: COLORS.secondary,
  },
  prestigeBodyWrap: {
    position: 'relative',
    flex: 1,
    marginHorizontal: 26,
    marginTop: 26,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    paddingHorizontal: 36,
    paddingTop: 44,
    paddingBottom: 28,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  prestigeInnerAccent: {
    position: 'absolute',
    top: 34,
    left: 34,
    right: 34,
    bottom: 34,
    borderWidth: 0.5,
    borderColor: COLORS.primary,
    opacity: 0.25,
  },
  prestigeDecorTop: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prestigeDecorInner: {
    width: 8,
    height: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 4,
  },
  prestigeLead: {
    fontSize: 10,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  prestigeName: {
    fontSize: 22,
    fontWeight: 600,
    color: COLORS.dark,
    textAlign: 'center',
    marginBottom: 12,
    maxWidth: 460,
  },
  prestigeCourseLine: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 6,
    textAlign: 'center',
  },
  prestigeCourse: {
    fontSize: 16,
    fontWeight: 600,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 460,
  },
  prestigeGrow: {
    flexGrow: 1,
    minHeight: 20,
  },
  prestigeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 400,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary,
  },
  prestigeMeta: {
    fontSize: 9,
    color: COLORS.muted,
  },
  prestigeExpiry: {
    fontSize: 9,
    color: COLORS.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  prestigeBottomBar: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 40,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  prestigeSite: {
    fontSize: 8,
    color: COLORS.secondary,
    letterSpacing: 1,
  },
  // —— minimal ——
  minimalWrap: {
    padding: 56,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimalLogo: {
    width: 120,
    height: 38,
    objectFit: 'contain',
    marginBottom: 12,
  },
  minimalTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: 6,
  },
  minimalSubtitle: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 32,
    textAlign: 'center',
  },
  minimalName: {
    fontSize: 24,
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: 12,
    textAlign: 'center',
  },
  minimalCourse: {
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 28,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  minimalExpiry: {
    fontSize: 9,
    color: COLORS.primary,
    marginTop: 8,
    textAlign: 'center',
  },
  // —— elegant ——
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
  elegantLogo: {
    width: 130,
    height: 42,
    objectFit: 'contain',
    marginBottom: 14,
  },
  elegantTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: COLORS.primary,
    letterSpacing: 3,
    marginBottom: 6,
  },
  elegantSubtitle: {
    fontSize: 10,
    color: COLORS.secondary,
    marginBottom: 28,
    textAlign: 'center',
  },
  elegantName: {
    fontSize: 20,
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: 12,
    textAlign: 'center',
  },
  elegantCourse: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 8,
  },
  elegantCourseName: {
    fontSize: 15,
    fontWeight: 600,
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  elegantFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary,
  },
  elegantMeta: {
    fontSize: 9,
    color: COLORS.muted,
  },
  elegantExpiry: {
    fontSize: 9,
    color: COLORS.primary,
    marginTop: 10,
    textAlign: 'center',
    width: '100%',
  },
});

import {
  type CertificateTemplateId,
  CERTIFICATE_TEMPLATE_IDS,
  CERTIFICATE_TEMPLATE_LABELS,
} from './certificates-constants';

export type { CertificateTemplateId };
export { CERTIFICATE_TEMPLATE_IDS, CERTIFICATE_TEMPLATE_LABELS };

const DEFAULT_TAGLINE = 'Phygital школа мышечного тестирования';

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
  name?: { x: number; y: number; fontSize?: number };
  date?: { x: number; y: number; fontSize?: number };
  courseTitle?: { x: number; y: number; fontSize?: number };
  certNumber?: { x: number; y: number; fontSize?: number };
  expiryDate?: { x: number; y: number; fontSize?: number };
}

function taglineFor(data: CertificateData) {
  return (data.tagline && data.tagline.trim()) || DEFAULT_TAGLINE;
}

function CertificateHeritage({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.heritagePage}>
      <View style={styles.heritageOuterFrame} />
      <View style={styles.heritageMidFrame} />
      <View style={styles.heritageInnerFrame} />
      <View style={styles.heritageCornerTL} />
      <View style={styles.heritageCornerTR} />
      <View style={styles.heritageCornerBL} />
      <View style={styles.heritageCornerBR} />
      <View style={styles.heritageBody}>
        {LOGO_SRC ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- PDF Image
          <Image src={LOGO_SRC} style={styles.heritageLogo} />
        ) : (
          <Text style={styles.heritageWordmark}>AVATERRA</Text>
        )}
        <Text style={styles.heritageTagline}>{taglineFor(data)}</Text>
        <Text style={styles.heritageCertLabel}>СЕРТИФИКАТ</Text>
        <Text style={styles.heritageTitle}>О прохождении обучения</Text>
        <View style={styles.heritageHairline} />
        <Text style={styles.heritageLead}>Настоящим удостоверяется, что</Text>
        <Text style={styles.heritageName}>{data.userName}</Text>
        <Text style={styles.heritageCourseHint}>успешно освоил(а) образовательную программу</Text>
        <Text style={styles.heritageCourse}>{data.courseName}</Text>
        <View style={styles.heritageGrow} />
        <View style={styles.heritageFooter}>
          <Text style={styles.heritageMeta}>Регистрационный № {data.certNumber}</Text>
          <Text style={styles.heritageMeta}>Дата выдачи: {data.date}</Text>
        </View>
        {exp ? <Text style={styles.heritageExpiry}>Действителен до {exp}</Text> : null}
        <Text style={styles.heritageSite}>avaterra.pro</Text>
      </View>
    </Page>
  );
}

function CertificatePrestige({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.prestigeHeader}>
        {LOGO_SRC ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={LOGO_SRC} style={styles.prestigeHeaderLogo} />
        ) : (
          <Text style={styles.prestigeHeaderWordmark}>AVATERRA</Text>
        )}
        <View style={styles.prestigeHeaderRight}>
          <Text style={styles.prestigeHeaderCaption}>AVATERRA</Text>
          <Text style={styles.prestigeHeaderTitle}>СЕРТИФИКАТ О ПРОХОЖДЕНИИ</Text>
        </View>
      </View>
      <View style={styles.prestigeGoldBar} />
      <View style={{ flex: 1, position: 'relative' }}>
        <View style={styles.prestigeBodyWrap}>
          <View style={styles.prestigeInnerAccent} />
          <View style={styles.prestigeDecorTop}>
            <View style={styles.prestigeDecorInner} />
          </View>
          <Text style={styles.prestigeLead}>Удостоверение</Text>
          <Text style={styles.prestigeName}>{data.userName}</Text>
          <Text style={styles.prestigeCourseLine}>прошёл(ла) программу</Text>
          <Text style={styles.prestigeCourse}>{data.courseName}</Text>
          <View style={styles.prestigeGrow} />
          <View style={styles.prestigeFooter}>
            <Text style={styles.prestigeMeta}>№ {data.certNumber}</Text>
            <Text style={styles.prestigeMeta}>{data.date}</Text>
          </View>
          {exp ? <Text style={styles.prestigeExpiry}>Действителен до {exp}</Text> : null}
        </View>
      </View>
      <View style={styles.prestigeBottomBar}>
        <Text style={styles.prestigeSite}>{taglineFor(data)} · avaterra.pro</Text>
      </View>
    </Page>
  );
}

function CertificateMinimal({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.pageCream}>
      <View style={styles.minimalWrap}>
        {LOGO_SRC ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={LOGO_SRC} style={styles.minimalLogo} />
        ) : null}
        <Text style={styles.minimalTitle}>{LOGO_SRC ? 'Сертификат' : 'AVATERRA'}</Text>
        <Text style={styles.minimalSubtitle}>{taglineFor(data)}</Text>
        <View style={styles.minimalDivider} />
        <Text style={styles.minimalName}>{data.userName}</Text>
        <Text style={styles.minimalCourse}>{data.courseName}</Text>
        <Text style={styles.minimalMeta}>
          № {data.certNumber} · {data.date}
        </Text>
        {exp ? <Text style={styles.minimalExpiry}>Действителен до {exp}</Text> : null}
      </View>
    </Page>
  );
}

function CertificateElegant({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.elegantBorder} />
      <View style={styles.elegantInner} />
      <View style={styles.elegantContent}>
        {LOGO_SRC ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={LOGO_SRC} style={styles.elegantLogo} />
        ) : null}
        <Text style={styles.elegantTitle}>{LOGO_SRC ? 'Сертификат' : 'AVATERRA'}</Text>
        <Text style={styles.elegantSubtitle}>{taglineFor(data)}</Text>
        <Text style={styles.elegantName}>{data.userName}</Text>
        <Text style={styles.elegantCourse}>успешно прошёл(ла) курс</Text>
        <Text style={styles.elegantCourseName}>{data.courseName}</Text>
        <View style={styles.elegantFooter}>
          <Text style={styles.elegantMeta}>№ {data.certNumber}</Text>
          <Text style={styles.elegantMeta}>{data.date}</Text>
        </View>
        {exp ? <Text style={styles.elegantExpiry}>Действителен до {exp}</Text> : null}
      </View>
    </Page>
  );
}

function pickTemplate(templateId: CertificateTemplateId, data: CertificateData): React.ReactElement {
  switch (templateId) {
    case 'prestige':
      return <CertificatePrestige data={data} />;
    case 'minimal':
      return <CertificateMinimal data={data} />;
    case 'elegant':
      return <CertificateElegant data={data} />;
    case 'heritage':
    default:
      return <CertificateHeritage data={data} />;
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
  const exp = data.expiryDate?.trim();
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
      {mapping.expiryDate && exp ? (
        <Text style={textStyle(mapping.expiryDate, 9)}>Действителен до {exp}</Text>
      ) : null}
    </Page>
  );
}

/**
 * Генерирует PDF по подложке (образу) и textMapping.
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
 * @param templateId — default | heritage (классика), prestige, minimal, elegant
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
