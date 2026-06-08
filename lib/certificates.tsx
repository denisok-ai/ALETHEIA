/**
 * Генерация PDF сертификатов в стиле публичного сайта AVATERRA.
 * Палитра как в `app/globals.css`: plum #856b92, rose #ce8fb0, lavender #faf9fc, periwinkle #b4b1d8.
 * Макеты: default/heritage — линейный фон, боковые точки, орнаменты SVG, печать, подписи;
 * prestige — диагональный паттерн, боковые акценты, цитата, бейджи; minimal — рамка-ореол и угловые скобки;
 * elegant — розетки по углам, процитированная строка, два орнамента;
 * vitality / awaken / path — витринные макеты: фото-подложка из `public/images/certificates/bg-*.png`
 * (если файла нет — прежний векторный фон); текст на светлой полупрозрачной панели для читаемости.
 * Шрифт: Noto Sans 400/600 (@fontsource/noto-sans), кириллица.
 */
import path from 'path';
import { existsSync } from 'fs';
import React from 'react';
import { BRAND_LOGO_PATHS } from './brand';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
  Font,
  Svg,
  Path,
  Line,
  Circle,
  Rect,
  Ellipse,
} from '@react-pdf/renderer';

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

/** Согласовано с лендингом: --plum, --rose, --lavender-light, --periwinkle, --text */
const COLORS = {
  primary: '#856b92',
  primaryDark: '#6d5679',
  secondary: '#ce8fb0',
  dark: '#1e293b',
  cream: '#faf9fc',
  parchment: '#f4f2f8',
  white: '#ffffff',
  muted: '#64748b',
  goldSoft: '#b4b1d8',
  roseWash: '#fdf5f9',
  /** Обводки в тон золотому логотипу (без заливки фона листа). */
  certGold: '#a67c52',
  certGoldLight: '#c9a86c',
  /** Как ссылки на блоге / витрине: акцент на белом фоне. */
  linkAccent: '#2d5aa1',
  /** Тёплое золото круга логотипа (скрин блога). */
  blogGold: '#c4a060',
  blogGoldDeep: '#8a6a3f',
  blogCream: '#fffdf8',
} as const;

/** A4 в пунктах @react-pdf/renderer — подложки Image и SVG одного размера */
const PDF_PAGE_W = 595.28;
const PDF_PAGE_H = 841.89;

/** Витринные фоны (копируются в репозиторий из дизайна); при отсутствии файла — SVG-запасной вариант */
const SHOWCASE_CERT_BG = {
  vitality: path.join(process.cwd(), 'public', 'images', 'certificates', 'bg-vitality.png'),
  awaken: path.join(process.cwd(), 'public', 'images', 'certificates', 'bg-awaken.png'),
  path: path.join(process.cwd(), 'public', 'images', 'certificates', 'bg-path.png'),
} as const;

const FONT_FAMILY = FONT_FAMILY_FALLBACK;

function ShowcaseLayoutBackground({
  imageSrc,
  vectorFallback,
}: {
  imageSrc: string;
  vectorFallback: React.ReactNode;
}) {
  if (existsSync(imageSrc)) {
    return (
      <>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image from @react-pdf/renderer has no alt prop */}
        <Image
          fixed
          src={imageSrc}
          style={{ position: 'absolute', top: 0, left: 0, width: PDF_PAGE_W, height: PDF_PAGE_H }}
        />
      </>
    );
  }
  return <>{vectorFallback}</>;
}

/** Только название школы (без растра) — запас, если файлов {@link BRAND_LOGO_PATHS} нет на диске. */
function CertificateWordmarkOnly({
  variant = 'onLight',
  marginBottom = 10,
  alignItems = 'center',
}: {
  variant?: 'onLight' | 'onDark';
  marginBottom?: number;
  alignItems?: 'center' | 'flex-start';
}) {
  const titleColor = variant === 'onDark' ? '#ffffff' : COLORS.primaryDark;
  const subColor = variant === 'onDark' ? '#f3e8f7' : COLORS.muted;
  const textAlign = alignItems === 'center' ? 'center' : 'left';
  return (
    <View
      style={{
        alignItems,
        alignSelf: alignItems === 'flex-start' ? 'flex-start' : 'center',
        marginBottom,
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: titleColor,
          letterSpacing: 2.5,
          textAlign,
        }}
      >
        АВАТЕРРА
      </Text>
      <Text style={{ fontSize: 8.5, color: subColor, marginTop: 4, letterSpacing: 0.3, textAlign }}>
        Школа мышечного тестирования
      </Text>
    </View>
  );
}

/** Первый существующий PNG из той же цепочки, что у `BrandLogo` на сайте (`lib/brand.ts`). */
function certificateBrandLogoAbsPath(): string | null {
  for (const urlPath of BRAND_LOGO_PATHS) {
    const rel = decodeURIComponent(urlPath.replace(/^\//, ''));
    const abs = path.join(process.cwd(), 'public', rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/** Логотип как на сайте; иначе текстовый {@link CertificateWordmarkOnly}. */
function CertificateSiteBrandMark({
  marginBottom = 10,
  alignItems = 'center',
  width = 148,
  height = 46,
}: {
  marginBottom?: number;
  alignItems?: 'center' | 'flex-start';
  width?: number;
  height?: number;
}) {
  const logoSrc = certificateBrandLogoAbsPath();
  if (logoSrc) {
    return (
      <View
        style={{
          alignItems,
          alignSelf: alignItems === 'flex-start' ? 'flex-start' : 'center',
          marginBottom,
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
        <Image src={logoSrc} style={{ width, height, objectFit: 'contain' }} />
      </View>
    );
  }
  return <CertificateWordmarkOnly marginBottom={marginBottom} variant="onLight" alignItems={alignItems} />;
}

/** Галочка в «печати» — символ ✓ в шрифте часто не встраивается в PDF. */
function HeritageSealCheckGraphic() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path
        d="M5 13 L10.5 18.5 L21 7"
        stroke="#ce8fb0"
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: FONT_FAMILY,
    backgroundColor: COLORS.white,
  },
  pageCream: {
    padding: 0,
    fontFamily: FONT_FAMILY,
    backgroundColor: COLORS.white,
  },
  // —— Классика (default / heritage) ——
  heritagePage: {
    backgroundColor: COLORS.white,
    fontFamily: FONT_FAMILY,
    padding: 0,
  },
  heritageOuterFrame: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 2,
    borderColor: COLORS.certGold,
    borderRadius: 3,
  },
  heritageMidFrame: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 2,
    opacity: 0.85,
  },
  heritageInnerFrame: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 40,
    borderWidth: 0.75,
    borderColor: COLORS.goldSoft,
    borderRadius: 1,
  },
  heritageCornerTL: {
    position: 'absolute',
    top: 44,
    left: 44,
    width: 36,
    height: 36,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  heritageCornerTR: {
    position: 'absolute',
    top: 44,
    right: 44,
    width: 36,
    height: 36,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.certGold,
  },
  heritageCornerBL: {
    position: 'absolute',
    bottom: 44,
    left: 44,
    width: 36,
    height: 36,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.certGold,
  },
  heritageCornerBR: {
    position: 'absolute',
    bottom: 44,
    right: 44,
    width: 36,
    height: 36,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  heritageBody: {
    flex: 1,
    paddingHorizontal: 48,
    paddingTop: 44,
    paddingBottom: 32,
    alignItems: 'center',
  },
  heritageLogo: {
    width: 200,
    height: 64,
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
    color: COLORS.certGold,
    letterSpacing: 5,
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
    width: 168,
    height: 0,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.certGold,
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
    minHeight: 8,
  },
  heritageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 420,
    borderTopWidth: 1,
    borderTopColor: COLORS.goldSoft,
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
    marginTop: 10,
    letterSpacing: 1,
  },
  heritageFlourishWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  heritageMicroLine: {
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  heritageFinePrint: {
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 420,
    lineHeight: 1.35,
  },
  heritageAwardBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  heritageSealOuter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: COLORS.certGold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  heritageSealInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 0.75,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heritageSealCaption: {
    maxWidth: 210,
    marginLeft: 14,
  },
  heritageSealCapTitle: {
    fontSize: 8,
    fontWeight: 600,
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  heritageSealCapSub: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 2,
  },
  heritageSignaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 400,
    marginTop: 12,
    paddingTop: 8,
  },
  heritageSigCol: {
    width: '42%',
    alignItems: 'center',
  },
  heritageSigLine: {
    fontSize: 9,
    color: COLORS.goldSoft,
    marginBottom: 4,
    letterSpacing: 1,
  },
  heritageSigCap: {
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
  },
  heritageSideDotsLeft: {
    position: 'absolute',
    left: 14,
    top: 248,
    flexDirection: 'column',
  },
  heritageSideDotsRight: {
    position: 'absolute',
    right: 14,
    top: 248,
    flexDirection: 'column',
  },
  heritageDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 0.75,
    borderColor: COLORS.certGold,
    opacity: 0.55,
    marginBottom: 6,
  },
  // —— Премиум (prestige) ——
  prestigeHeader: {
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.certGold,
    paddingVertical: 20,
    paddingHorizontal: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prestigeHeaderLogo: {
    width: 132,
    height: 52,
    objectFit: 'contain',
  },
  prestigeHeaderWordmark: {
    fontSize: 16,
    fontWeight: 600,
    color: COLORS.primaryDark,
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
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.primaryDark,
    letterSpacing: 2,
  },
  prestigeGoldBar: {
    height: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.certGoldLight,
    opacity: 0.9,
  },
  prestigeBodyWrap: {
    position: 'relative',
    flex: 1,
    marginHorizontal: 26,
    marginTop: 26,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.certGold,
    borderRadius: 4,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: COLORS.certGold,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prestigeDecorInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.25,
    borderColor: COLORS.certGoldLight,
    backgroundColor: COLORS.white,
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
    borderTopColor: COLORS.certGold,
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
    backgroundColor: COLORS.white,
    borderTopWidth: 2,
    borderTopColor: COLORS.certGold,
    paddingVertical: 12,
    paddingHorizontal: 40,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  prestigeSite: {
    fontSize: 8,
    color: COLORS.muted,
    letterSpacing: 1,
  },
  prestigeQuote: {
    fontSize: 8,
    fontStyle: 'normal',
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 400,
    lineHeight: 1.45,
  },
  prestigeBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
  },
  prestigeBadge: {
    borderWidth: 1,
    borderColor: COLORS.goldSoft,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
    marginHorizontal: 4,
    marginBottom: 4,
  },
  prestigeBadgeText: {
    fontSize: 7,
    color: COLORS.primary,
    fontWeight: 600,
  },
  prestigeSideAccentLeft: {
    position: 'absolute',
    left: 10,
    top: 130,
    width: 0,
    height: 300,
    borderLeftWidth: 1.25,
    borderLeftColor: COLORS.certGold,
    opacity: 0.55,
  },
  prestigeSideAccentRight: {
    position: 'absolute',
    right: 10,
    top: 130,
    width: 0,
    height: 300,
    borderRightWidth: 1.25,
    borderRightColor: COLORS.primary,
    opacity: 0.35,
  },
  // —— minimal ——
  minimalWrap: {
    padding: 56,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimalLogo: {
    width: 128,
    height: 52,
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
    width: 96,
    height: 0,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.certGold,
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
  minimalOuterGlow: {
    position: 'absolute',
    top: 26,
    left: 26,
    right: 26,
    bottom: 26,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 10,
    opacity: 0.4,
  },
  minimalCornerTL: {
    position: 'absolute',
    top: 38,
    left: 38,
    width: 56,
    height: 56,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.secondary,
    opacity: 0.5,
    borderRadius: 2,
  },
  minimalCornerBR: {
    position: 'absolute',
    bottom: 38,
    right: 38,
    width: 56,
    height: 56,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
    opacity: 0.4,
    borderRadius: 2,
  },
  minimalKicker: {
    fontSize: 8,
    letterSpacing: 3,
    color: COLORS.secondary,
    marginBottom: 10,
    fontWeight: 600,
  },
  minimalFlourish: {
    marginBottom: 14,
    alignItems: 'center',
  },
  minimalSchoolLine: {
    fontSize: 9,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 24,
    maxWidth: 340,
    lineHeight: 1.45,
  },
  // —— elegant ——
  elegantBorder: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    bottom: 32,
    borderWidth: 2,
    borderColor: COLORS.certGold,
    borderRadius: 4,
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
    borderRadius: 2,
  },
  elegantContent: {
    padding: 72,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  elegantLogo: {
    width: 140,
    height: 52,
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
    borderTopColor: COLORS.certGold,
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
  elegantBadge: {
    borderWidth: 1,
    borderColor: COLORS.goldSoft,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginBottom: 14,
    backgroundColor: COLORS.white,
  },
  elegantBadgeText: {
    fontSize: 8,
    color: COLORS.primary,
    fontWeight: 600,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  elegantQuote: {
    fontSize: 9,
    color: COLORS.muted,
    fontStyle: 'normal',
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 420,
    lineHeight: 1.5,
  },
  elegantRosetteTL: {
    position: 'absolute',
    top: 52,
    left: 52,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: COLORS.certGold,
    opacity: 0.65,
    backgroundColor: COLORS.white,
  },
  elegantRosetteTR: {
    position: 'absolute',
    top: 52,
    right: 52,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: COLORS.primary,
    opacity: 0.45,
    backgroundColor: COLORS.white,
  },
  elegantRosetteBL: {
    position: 'absolute',
    bottom: 52,
    left: 52,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: COLORS.primary,
    opacity: 0.4,
    backgroundColor: COLORS.white,
  },
  elegantRosetteBR: {
    position: 'absolute',
    bottom: 52,
    right: 52,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.25,
    borderColor: COLORS.certGold,
    opacity: 0.55,
    backgroundColor: COLORS.white,
  },
  elegantBottomNote: {
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.3,
  },
});

import {
  type CertificateTemplateId,
  CERTIFICATE_TEMPLATE_IDS,
  CERTIFICATE_TEMPLATE_LABELS,
} from './certificates-constants';

export type { CertificateTemplateId };
export { CERTIFICATE_TEMPLATE_IDS, CERTIFICATE_TEMPLATE_LABELS };

const DEFAULT_TAGLINE = 'Школа «AVATERRA» · мышечное тестирование';

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

function taglineFor(data: CertificateData) {
  return (data.tagline && data.tagline.trim()) || DEFAULT_TAGLINE;
}

/** Светлый лист + диагональная сетка и контурные дуги (без крупных заливок) — заметнее и ровнее на печати. */
function HeritageBackgroundArt() {
  const W = 595;
  const H = 842;
  const diagonals = Array.from({ length: 20 }, (_, i) => {
    const x0 = -48 + i * 42;
    return (
      <Line
        key={`d-${i}`}
        x1={x0}
        y1={0}
        x2={x0 + 130}
        y2={H}
        stroke="#ebe6f8"
        strokeWidth={0.35}
      />
    );
  });
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#ffffff" />
        {diagonals}
        <Path d="M 0 92 A 92 92 0 0 1 92 0" fill="none" stroke="#ce8fb0" strokeWidth={1.1} opacity={0.42} />
        <Path d="M 503 0 A 92 92 0 0 1 595 92" fill="none" stroke="#856b92" strokeWidth={1.1} opacity={0.42} />
        <Path d="M 0 750 A 92 92 0 0 0 92 842" fill="none" stroke="#b4b1d8" strokeWidth={1.1} opacity={0.42} />
        <Path d="M 595 750 A 92 92 0 0 1 503 842" fill="none" stroke="#ce8fb0" strokeWidth={1.1} opacity={0.42} />
        <Circle cx={W / 2} cy={H / 2} r={195} fill="none" stroke="#856b92" strokeWidth={0.45} opacity={0.12} />
        <Circle
          cx={W / 2}
          cy={H / 2}
          r={235}
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.4}
          strokeDasharray="5 10"
          opacity={0.22}
        />
        <Path
          d="M 520 120 Q 480 80 440 120"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.55}
          opacity={0.35}
        />
        <Path
          d="M 75 720 Q 115 760 155 720"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.55}
          opacity={0.32}
        />
        <Path
          d="M 400 0 L 595 0 L 595 140"
          fill="none"
          stroke="#856b92"
          strokeWidth={1.4}
          opacity={0.35}
        />
        <Path
          d="M 0 720 L 0 842 L 160 842"
          fill="none"
          stroke="#ce8fb0"
          strokeWidth={1.2}
          opacity={0.3}
        />
      </Svg>
    </View>
  );
}

/** Премиум: белый лист + тонкие диагонали и кольцо. */
function PrestigeBackgroundArt() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox="0 0 595 842">
        <Rect width="595" height="842" fill="#ffffff" />
        <Line x1="0" y1="0" x2="595" y2="842" stroke="#e8e0f0" strokeWidth={0.3} />
        <Line x1="595" y1="0" x2="0" y2="842" stroke="#e8e0f0" strokeWidth={0.3} />
        <Circle cx="297.5" cy="410" r="260" fill="none" stroke="#856b92" strokeWidth={0.35} opacity={0.09} />
        <Circle cx="297.5" cy="410" r="198" fill="none" stroke="#a67c52" strokeWidth={0.4} opacity={0.14} strokeDasharray="4 14" />
      </Svg>
    </View>
  );
}

/** Минимализм: редкая точечная сетка вместо заливки. */
function MinimalBackgroundArt() {
  const dots = Array.from({ length: 120 }, (_, i) => {
    const row = Math.floor(i / 10);
    const col = i % 10;
    return (
      <Circle
        key={`dot-${i}`}
        cx={48 + col * 56}
        cy={64 + row * 58}
        r={1}
        fill="none"
        stroke="#a67c52"
        strokeWidth={0.4}
        opacity={0.28}
      />
    );
  });
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox="0 0 595 842">
        <Rect width="595" height="842" fill="#ffffff" />
        {dots}
      </Svg>
    </View>
  );
}

/** Элегант: лёгкие волнообразные линии. */
function ElegantBackgroundArt() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox="0 0 595 842">
        <Rect width="595" height="842" fill="#ffffff" />
        <Path
          d="M 0 200 Q 148 160 297 200 T 595 200"
          fill="none"
          stroke="#ce8fb0"
          strokeWidth={0.45}
          opacity={0.28}
        />
        <Path
          d="M 0 480 Q 148 520 297 480 T 595 480"
          fill="none"
          stroke="#856b92"
          strokeWidth={0.45}
          opacity={0.22}
        />
        <Path
          d="M 0 650 Q 200 610 297 650 T 595 650"
          fill="none"
          stroke="#b4b1d8"
          strokeWidth={0.35}
          opacity={0.2}
        />
      </Svg>
    </View>
  );
}

function HeritageOrnamentBar() {
  return (
    <View style={styles.heritageFlourishWrap}>
      <Svg width={200} height={30} viewBox="0 0 200 30">
        <Line x1="0" y1="15" x2="72" y2="15" stroke="#a67c52" strokeWidth={0.9} />
        <Path
          d="M 100 8.5 L 105.5 15 L 100 21.5 L 94.5 15 Z"
          fill="none"
          stroke="#a67c52"
          strokeWidth={1}
        />
        <Line x1="128" y1="15" x2="200" y2="15" stroke="#a67c52" strokeWidth={0.9} />
        <Path
          d="M 68 15 Q 84 5 100 15 Q 116 5 132 15"
          stroke="#856b92"
          strokeWidth={0.75}
          fill="none"
          opacity={0.55}
        />
      </Svg>
    </View>
  );
}

function HeritageOrnamentSmall() {
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Svg width={120} height={16} viewBox="0 0 120 16">
        <Line x1="0" y1="8" x2="44" y2="8" stroke="#b4b1d8" strokeWidth={0.75} />
        <Circle cx="60" cy="8" r="3" stroke="#ce8fb0" strokeWidth={1} fill="#ffffff" />
        <Line x1="76" y1="8" x2="120" y2="8" stroke="#b4b1d8" strokeWidth={0.75} />
      </Svg>
    </View>
  );
}

function HeritageSideDots({ side }: { side: 'left' | 'right' }) {
  const n = 12;
  return (
    <View style={side === 'left' ? styles.heritageSideDotsLeft : styles.heritageSideDotsRight}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={[styles.heritageDot, i === n - 1 ? { marginBottom: 0 } : {}]} />
      ))}
    </View>
  );
}

function PrestigeDiagonalPattern() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.055 }}>
      <Svg width={595} height={540} viewBox="0 0 595 540">
        {[0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448].map((y) => (
          <Line key={y} x1={0} y1={y} x2={595} y2={y + 48} stroke="#a67c52" strokeWidth={0.35} />
        ))}
      </Svg>
    </View>
  );
}

function ElegantFlourishHeader() {
  return (
    <View style={{ alignItems: 'center', marginBottom: 12 }}>
      <Svg width={220} height={36} viewBox="0 0 220 36">
        <Path
          d="M 0 18 Q 55 6 110 18 T 220 18"
          stroke="#ce8fb0"
          strokeWidth={1}
          fill="none"
          opacity={0.65}
        />
        <Path
          d="M 110 10 L 114 18 L 110 26 L 106 18 Z"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.95}
          opacity={0.75}
        />
      </Svg>
    </View>
  );
}

function ElegantFlourishFooter() {
  return (
    <View style={{ alignItems: 'center', marginTop: 14 }}>
      <Svg width={180} height={20} viewBox="0 0 180 20">
        <Line x1="0" y1="10" x2="180" y2="10" stroke="#b4b1d8" strokeWidth={0.6} />
        {[30, 60, 90, 120, 150].map((x) => (
          <Circle key={x} cx={x} cy={10} r={1.5} fill="#ce8fb0" fillOpacity={0.5} />
        ))}
      </Svg>
    </View>
  );
}

function CertificateHeritage({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.heritagePage}>
      <HeritageBackgroundArt />
      <View style={styles.heritageOuterFrame} />
      <View style={styles.heritageMidFrame} />
      <View style={styles.heritageInnerFrame} />
      <View style={styles.heritageCornerTL} />
      <View style={styles.heritageCornerTR} />
      <View style={styles.heritageCornerBL} />
      <View style={styles.heritageCornerBR} />
      <HeritageSideDots side="left" />
      <HeritageSideDots side="right" />
      <View style={styles.heritageBody}>
        <CertificateSiteBrandMark marginBottom={10} />
        <Text style={styles.heritageTagline}>{taglineFor(data)}</Text>
        <HeritageOrnamentBar />
        <Text style={styles.heritageMicroLine}>Официальный документ об образовании · Школа «AVATERRA»</Text>
        <Text style={styles.heritageCertLabel}>СЕРТИФИКАТ</Text>
        <Text style={styles.heritageTitle}>О прохождении обучения</Text>
        <View style={styles.heritageHairline} />
        <Text style={styles.heritageLead}>Настоящим удостоверяется, что</Text>
        <Text style={styles.heritageName}>{data.userName}</Text>
        <Text style={styles.heritageCourseHint}>успешно освоил(а) образовательную программу</Text>
        <Text style={styles.heritageCourse}>{data.courseName}</Text>
        <HeritageOrnamentSmall />
        <View style={styles.heritageAwardBlock}>
          <View style={styles.heritageSealOuter}>
            <View style={styles.heritageSealInner}>
              <HeritageSealCheckGraphic />
            </View>
          </View>
          <View style={styles.heritageSealCaption}>
            <Text style={styles.heritageSealCapTitle}>УЧАСТИЕ ПОДТВЕРЖДЕНО</Text>
            <Text style={styles.heritageSealCapSub}>Регистрация в базе школы по номеру сертификата</Text>
          </View>
        </View>
        <View style={styles.heritageGrow} />
        <View style={styles.heritageSignaturesRow}>
          <View style={styles.heritageSigCol}>
            <Text style={styles.heritageSigLine}>________________________</Text>
            <Text style={styles.heritageSigCap}>Руководитель программы</Text>
          </View>
          <View style={styles.heritageSigCol}>
            <Text style={styles.heritageSigLine}>________________________</Text>
            <Text style={styles.heritageSigCap}>Печать / электронная отметка</Text>
          </View>
        </View>
        <View style={styles.heritageFooter}>
          <Text style={styles.heritageMeta}>Регистрационный № {data.certNumber}</Text>
          <Text style={styles.heritageMeta}>Дата выдачи: {data.date}</Text>
        </View>
        <Text style={styles.heritageFinePrint}>
          Документ подтверждает факт прохождения указанной программы. Подлинность можно проверить по номеру на
          сайте школы.
        </Text>
        {exp ? <Text style={styles.heritageExpiry}>Действителен до {exp}</Text> : null}
        <Text style={styles.heritageSite}>avaterra.pro · школа мышечного тестирования</Text>
      </View>
    </Page>
  );
}

function CertificatePrestige({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const brandLogo = certificateBrandLogoAbsPath();
  return (
    <Page size="A4" style={styles.page}>
      <PrestigeBackgroundArt />
      <View style={styles.prestigeHeader}>
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          {brandLogo ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
              <Image src={brandLogo} style={styles.prestigeHeaderLogo} />
            </>
          ) : (
            <Text style={styles.prestigeHeaderWordmark}>АВАТЕРРА</Text>
          )}
        </View>
        <View style={styles.prestigeHeaderRight}>
          <Text style={styles.prestigeHeaderTitle}>СЕРТИФИКАТ</Text>
          <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 4, letterSpacing: 1.2, textAlign: 'right' }}>
            О ПРОХОЖДЕНИИ ОБУЧЕНИЯ
          </Text>
        </View>
      </View>
      <View style={styles.prestigeGoldBar} />
      <View style={{ flex: 1, position: 'relative' }}>
        <PrestigeDiagonalPattern />
        <View style={styles.prestigeSideAccentLeft} />
        <View style={styles.prestigeSideAccentRight} />
        <View style={styles.prestigeBodyWrap}>
          <View style={styles.prestigeInnerAccent} />
          <View style={styles.prestigeDecorTop}>
            <View style={styles.prestigeDecorInner} />
          </View>
          <Text style={styles.prestigeLead}>Удостоверение</Text>
          <Text style={styles.prestigeName}>{data.userName}</Text>
          <Text style={styles.prestigeCourseLine}>прошёл(ла) программу</Text>
          <Text style={styles.prestigeCourse}>{data.courseName}</Text>
          <Text style={styles.prestigeQuote}>
            «Тело отвечает честно — когда мы знаем, как задать вопрос.»
          </Text>
          <View style={styles.prestigeBadgeRow}>
            <View style={styles.prestigeBadge}>
              <Text style={styles.prestigeBadgeText}>Практикум</Text>
            </View>
            <View style={styles.prestigeBadge}>
              <Text style={styles.prestigeBadgeText}>Живые сессии</Text>
            </View>
            <View style={styles.prestigeBadge}>
              <Text style={styles.prestigeBadgeText}>Кураторы</Text>
            </View>
          </View>
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
      <MinimalBackgroundArt />
      <View style={styles.minimalOuterGlow} />
      <View style={styles.minimalCornerTL} />
      <View style={styles.minimalCornerBR} />
      <View style={styles.minimalWrap}>
        <CertificateSiteBrandMark marginBottom={20} />
        <Text style={styles.minimalKicker}>ОФИЦИАЛЬНО</Text>
        <Text style={styles.minimalTitle}>Сертификат</Text>
        <Text style={styles.minimalSubtitle}>{taglineFor(data)}</Text>
        <View style={styles.minimalDivider} />
        <Text style={styles.minimalName}>{data.userName}</Text>
        <Text style={styles.minimalCourse}>{data.courseName}</Text>
        <Text style={styles.minimalMeta}>
          № {data.certNumber} · {data.date}
        </Text>
        {exp ? <Text style={styles.minimalExpiry}>Действителен до {exp}</Text> : null}
        <Text style={styles.minimalSchoolLine}>
          Настоящий сертификат удостоверяет успешное освоение программы и может использоваться как подтверждение
          квалификации в рамках методики школы.
        </Text>
      </View>
    </Page>
  );
}

function CertificateElegant({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  return (
    <Page size="A4" style={styles.page}>
      <ElegantBackgroundArt />
      <View style={styles.elegantRosetteTL} />
      <View style={styles.elegantRosetteTR} />
      <View style={styles.elegantRosetteBL} />
      <View style={styles.elegantRosetteBR} />
      <View style={styles.elegantBorder} />
      <View style={styles.elegantInner} />
      <View style={styles.elegantContent}>
        <CertificateSiteBrandMark marginBottom={14} />
        <ElegantFlourishHeader />
        <View style={styles.elegantBadge}>
          <Text style={styles.elegantBadgeText}>ОФИЦИАЛЬНАЯ ЗАПИСЬ О ПРОХОЖДЕНИИ</Text>
        </View>
        <Text style={styles.elegantTitle}>Сертификат</Text>
        <Text style={styles.elegantSubtitle}>{taglineFor(data)}</Text>
        <Text style={styles.elegantQuote}>
          «Образование — это не запоминание, а согласие тела с новым опытом.»
        </Text>
        <Text style={styles.elegantName}>{data.userName}</Text>
        <Text style={styles.elegantCourse}>успешно прошёл(ла) курс</Text>
        <Text style={styles.elegantCourseName}>{data.courseName}</Text>
        <View style={styles.elegantFooter}>
          <Text style={styles.elegantMeta}>№ {data.certNumber}</Text>
          <Text style={styles.elegantMeta}>{data.date}</Text>
        </View>
        {exp ? <Text style={styles.elegantExpiry}>Действителен до {exp}</Text> : null}
        <ElegantFlourishFooter />
        <Text style={styles.elegantBottomNote}>Школа «AVATERRA» · мышечное тестирование</Text>
      </View>
    </Page>
  );
}

/** Витрина: тело и тестирование — тёплая колонка «как на блоге», золото + нейтральный текст. */
function VitalityBackgroundArt() {
  const W = 595;
  const H = 842;
  const spine = 'M 118 118 Q 104 260 118 420 Q 132 580 118 718';
  const points = [160, 240, 360, 480, 620];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#ffffff" />
        <Rect x={0} y={0} width={132} height={H} fill="#f4ead8" />
        <Rect x={0} y={0} width={132} height={H} fill="#c4a060" opacity={0.12} />
        <Path d="M 132 0 L 132 842" stroke="#c4a060" strokeWidth={1.4} opacity={0.55} />
        <Path d={spine} fill="none" stroke="#8a6a3f" strokeWidth={2.5} strokeLinecap="round" opacity={0.88} />
        <Path d={spine} fill="none" stroke="#2d5aa1" strokeWidth={0.9} strokeLinecap="round" opacity={0.22} />
        {points.map((cy, i) => (
          <Circle key={`pt-${i}`} cx={118} cy={cy} r={5} fill="#fffdf8" stroke="#a67c52" strokeWidth={0.6} />
        ))}
        <Path
          d="M 200 96 L 540 96 L 520 132 L 220 132 Z"
          fill="none"
          stroke="#c4a060"
          strokeWidth={0.95}
          opacity={0.5}
        />
        <Path
          d="M 360 720 Q 420 660 520 700"
          fill="none"
          stroke="#2d5aa1"
          strokeWidth={0.9}
          opacity={0.28}
        />
        <Circle cx={478} cy={198} r={74} fill="none" stroke="#c4a060" strokeWidth={0.45} opacity={0.22} />
        <Circle cx={478} cy={198} r={108} fill="none" stroke="#2d5aa1" strokeWidth={0.35} opacity={0.14} strokeDasharray="5 11" />
      </Svg>
    </View>
  );
}

function CertificateVitality({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const photo = existsSync(SHOWCASE_CERT_BG.vitality);
  return (
    <Page size="A4" style={styles.page}>
      <ShowcaseLayoutBackground imageSrc={SHOWCASE_CERT_BG.vitality} vectorFallback={<VitalityBackgroundArt />} />
      <View
        style={{
          position: 'absolute',
          top: 44,
          left: photo ? 124 : 152,
          right: photo ? 28 : 40,
          bottom: 44,
          ...(photo
            ? {
                backgroundColor: 'rgba(255, 253, 248, 0.93)',
                paddingTop: 10,
                paddingBottom: 10,
                paddingLeft: 22,
                paddingRight: 14,
                borderRadius: 6,
                borderLeftWidth: 2,
                borderLeftColor: COLORS.certGoldLight,
              }
            : {}),
        }}
      >
        <CertificateSiteBrandMark marginBottom={6} alignItems="flex-start" width={158} height={48} />
        <View
          style={{
            marginTop: 22,
            paddingBottom: 10,
            borderBottomWidth: 2,
            borderBottomColor: COLORS.linkAccent,
            width: 140,
            opacity: 0.85,
          }}
        />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, color: COLORS.blogGold, marginTop: 22, fontWeight: 600 }}>
          СЕРТИФИКАТ
        </Text>
        <Text style={{ fontSize: 20, color: COLORS.primaryDark, marginTop: 10, fontWeight: 600 }}>Тело знает ответ</Text>
        <Text style={{ fontSize: 9.5, color: COLORS.muted, marginTop: 8, lineHeight: 1.45, maxWidth: 380 }}>
          Материалы для тех, кто хочет слышать тело глубже и работать с причиной, а не только со следствием.
        </Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 28 }}>Удостоверяется, что</Text>
        <Text style={{ fontSize: 22, color: COLORS.dark, marginTop: 8, fontWeight: 600 }}>{data.userName}</Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 14 }}>успешно прошёл(ла) программу</Text>
        <Text style={{ fontSize: 15, color: COLORS.primary, marginTop: 6, fontWeight: 600 }}>{data.courseName}</Text>
        <View style={{ flexDirection: 'row', marginTop: 22, flexWrap: 'wrap' }}>
          {['Живое обучение', 'Практика с телом', 'Документ для портфолио'].map((t) => (
            <View
              key={t}
              style={{
                borderWidth: 1,
                borderColor: COLORS.certGold,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 20,
                marginRight: 8,
                marginBottom: 6,
                backgroundColor: COLORS.blogCream,
              }}
            >
              <Text style={{ fontSize: 8, color: COLORS.blogGoldDeep }}>{t}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8.5, color: COLORS.muted, lineHeight: 1.4, maxWidth: 400 }}>
          Поделитесь достижением — отметьте @avaterra.pro · #мышечноетестирование · #Аватерра
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 0.5,
            borderTopColor: COLORS.certGold,
          }}
        >
          <Text style={{ fontSize: 9, color: COLORS.dark }}>№ {data.certNumber}</Text>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>{data.date}</Text>
        </View>
        {exp ? <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 6 }}>Действителен до {exp}</Text> : null}
        <Text style={{ fontSize: 9, color: COLORS.linkAccent, marginTop: 10, fontWeight: 600 }}>avaterra.pro</Text>
      </View>
    </Page>
  );
}

/** Витрина: пробуждение — тёплый свет, движение, эмоциональная ценность. */
function AwakenBackgroundArt() {
  const W = 595;
  const H = 842;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#fffaf7" />
        <Ellipse cx={297} cy={138} rx={220} ry={118} fill="#fdecef" opacity={0.95} />
        <Ellipse cx={297} cy={128} rx={140} ry={72} fill="#fce4d6" opacity={0.55} />
        <Circle cx={297} cy={118} r={48} fill="#f6c4a8" opacity={0.35} />
        <Path
          d="M 0 280 Q 180 220 297 300 T 595 260"
          fill="none"
          stroke="#ce8fb0"
          strokeWidth={1.4}
          opacity={0.45}
        />
        <Path
          d="M 40 520 Q 200 420 297 520 Q 400 620 555 500"
          fill="none"
          stroke="#856b92"
          strokeWidth={1.1}
          opacity={0.35}
        />
        <Path
          d="M 320 400 Q 380 340 440 400 Q 400 480 340 460 Q 300 420 320 400"
          fill="none"
          stroke="#b4b1d8"
          strokeWidth={1.6}
          opacity={0.5}
        />
        <Path
          d="M 120 680 Q 297 600 475 680"
          fill="none"
          stroke="#a67c52"
          strokeWidth={0.9}
          opacity={0.4}
        />
        <Path
          d="M 48 88 Q 297 48 548 92"
          fill="none"
          stroke="#2d5aa1"
          strokeWidth={0.55}
          opacity={0.35}
        />
        <Rect x={32} y={32} width={W - 64} height={H - 64} fill="none" stroke="#a67c52" strokeWidth={1.5} opacity={0.55} />
        <Rect x={44} y={44} width={W - 88} height={H - 88} fill="none" stroke="#2d5aa1" strokeWidth={0.5} opacity={0.28} />
      </Svg>
    </View>
  );
}

function CertificateAwaken({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const photo = existsSync(SHOWCASE_CERT_BG.awaken);
  return (
    <Page size="A4" style={styles.page}>
      <ShowcaseLayoutBackground imageSrc={SHOWCASE_CERT_BG.awaken} vectorFallback={<AwakenBackgroundArt />} />
      <View style={{ position: 'absolute', top: 56, left: 56, right: 56, bottom: 56, alignItems: 'center' }}>
        <View
          style={{
            alignItems: 'center',
            width: '100%',
            maxWidth: 460,
            height: '100%',
            ...(photo
              ? {
                  backgroundColor: 'rgba(255, 253, 248, 0.94)',
                  paddingVertical: 26,
                  paddingHorizontal: 28,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(166, 124, 82, 0.35)',
                }
              : {}),
          }}
        >
        <CertificateSiteBrandMark marginBottom={8} width={168} height={52} />
        <Text style={{ fontSize: 12, letterSpacing: 2, color: COLORS.blogGold, marginTop: 28, fontWeight: 600 }}>СЕРТИФИКАТ</Text>
        <Text style={{ fontSize: 22, color: COLORS.primaryDark, marginTop: 10, fontWeight: 600, textAlign: 'center' }}>
          Пробуждение через тело
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.muted, marginTop: 12, textAlign: 'center', maxWidth: 420, lineHeight: 1.5 }}>
          «Когда тело просыпается, меняется и жизнь. Этот сертификат — память о живом опыте, который остаётся с
          вами.»
        </Text>
        <View style={{ height: 2, width: 168, backgroundColor: COLORS.linkAccent, marginTop: 22, opacity: 0.45 }} />
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 26 }}>Настоящим удостоверяется, что</Text>
        <Text style={{ fontSize: 21, color: COLORS.dark, marginTop: 8, fontWeight: 600, textAlign: 'center' }}>{data.userName}</Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 14 }}>прошёл(ла) программу</Text>
        <Text style={{ fontSize: 15, color: COLORS.primary, marginTop: 6, fontWeight: 600, textAlign: 'center' }}>{data.courseName}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8.5, color: COLORS.muted, textAlign: 'center', lineHeight: 1.45, maxWidth: 440 }}>
          Сохраните PDF — он отлично смотрится в сторис и на печати. Отметьте школу: @avaterra.pro · #Пробуждение
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 16, paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>№ {data.certNumber}</Text>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>{data.date}</Text>
        </View>
        {exp ? <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 8 }}>Действителен до {exp}</Text> : null}
        <Text style={{ fontSize: 9, color: COLORS.linkAccent, marginTop: 12, fontWeight: 600 }}>avaterra.pro</Text>
        </View>
      </View>
    </Page>
  );
}

/** Витрина: первый шаг — доверие, вход в сообщество практиков. */
function PathBackgroundArt() {
  const W = 595;
  const H = 842;
  const stones = [0, 1, 2, 3, 4].map((i) => {
    const x = 120 + i * 88;
    const y = 620 - i * 36 + Math.sin(i) * 8;
    return <Circle key={`st-${i}`} cx={x} cy={y} r={14} fill="#faf9fc" stroke="#a67c52" strokeWidth={1.2} opacity={0.85} />;
  });
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width={595.28} height={841.89} viewBox={`0 0 ${W} ${H}`}>
        <Rect width={W} height={H} fill="#faf9fc" />
        <Path d="M 180 120 Q 297 40 415 120" fill="none" stroke="#c4a060" strokeWidth={1.8} opacity={0.42} />
        <Path d="M 200 120 L 395 120" stroke="#2d5aa1" strokeWidth={0.65} opacity={0.35} />
        <Circle cx={297} cy={118} r={6} fill="#c4a060" opacity={0.55} />
        <Path
          d="M 0 760 Q 150 680 297 720 T 595 740 L 595 842 L 0 842 Z"
          fill="#ebe6f8"
          opacity={0.55}
        />
        {stones}
        <Path
          d="M 134 616 Q 220 560 297 600 T 460 640"
          fill="none"
          stroke="#856b92"
          strokeWidth={0.8}
          opacity={0.35}
          strokeDasharray="4 8"
        />
        <Rect x={36} y={36} width={W - 72} height={H - 72} fill="none" stroke="#c4a060" strokeWidth={1} opacity={0.45} />
      </Svg>
    </View>
  );
}

function CertificatePath({ data }: { data: CertificateData }) {
  const exp = data.expiryDate?.trim();
  const photo = existsSync(SHOWCASE_CERT_BG.path);
  return (
    <Page size="A4" style={styles.page}>
      <ShowcaseLayoutBackground imageSrc={SHOWCASE_CERT_BG.path} vectorFallback={<PathBackgroundArt />} />
      <View
        style={{
          position: 'absolute',
          top: 48,
          left: photo ? 40 : 52,
          right: photo ? 40 : 52,
          bottom: 200,
          ...(photo
            ? {
                backgroundColor: 'rgba(250, 249, 252, 0.94)',
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 18,
                paddingRight: 18,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(133, 107, 146, 0.25)',
              }
            : {}),
        }}
      >
        <CertificateSiteBrandMark marginBottom={4} alignItems="flex-start" width={156} height={48} />
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 24,
            backgroundColor: COLORS.blogCream,
            borderWidth: 1,
            borderColor: COLORS.certGold,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 4,
          }}
        >
          <Text style={{ fontSize: 8, color: COLORS.blogGoldDeep, fontWeight: 600, letterSpacing: 1.2 }}>СТАРТ ПРАКТИКИ</Text>
        </View>
        <Text style={{ fontSize: 20, color: COLORS.primaryDark, marginTop: 18, fontWeight: 600 }}>Первый шаг сделан</Text>
        <Text style={{ fontSize: 9.5, color: COLORS.muted, marginTop: 10, lineHeight: 1.45, maxWidth: 400 }}>
          Этот сертификат — не «галочка», а вход в сообщество людей, которые разговаривают с телом на языке
          уважения и точности.
        </Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 36 }}>Удостоверяется, что</Text>
        <Text style={{ fontSize: 21, color: COLORS.dark, marginTop: 8, fontWeight: 600 }}>{data.userName}</Text>
        <Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 14 }}>освоил(а) вводную программу</Text>
        <Text style={{ fontSize: 15, color: COLORS.primaryDark, marginTop: 6, fontWeight: 600 }}>{data.courseName}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 8.5, color: COLORS.muted, lineHeight: 1.4 }}>
          Расскажите друзьям, как начался ваш путь: @avaterra.pro · #Аватерра · #Мышечноетестирование
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>№ {data.certNumber}</Text>
          <Text style={{ fontSize: 9, color: COLORS.dark }}>{data.date}</Text>
        </View>
        {exp ? <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 6 }}>Действителен до {exp}</Text> : null}
      </View>
      <View style={{ position: 'absolute', bottom: 36, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: COLORS.linkAccent, fontWeight: 600 }}>avaterra.pro</Text>
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
    case 'vitality':
      return <CertificateVitality data={data} />;
    case 'awaken':
      return <CertificateAwaken data={data} />;
    case 'path':
      return <CertificatePath data={data} />;
    case 'heritage':
    default:
      return <CertificateHeritage data={data} />;
  }
}

const A4_WIDTH = PDF_PAGE_W;
const A4_HEIGHT = PDF_PAGE_H;

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
  const brandLogo = certificateBrandLogoAbsPath();
  return (
    <Page size="A4" style={{ padding: 0, fontFamily: FONT_FAMILY }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF Image from @react-pdf/renderer has no alt prop */}
      <Image
        src={backgroundSrc}
        style={{ position: 'absolute', top: 0, left: 0, width: A4_WIDTH, height: A4_HEIGHT }}
      />
      <View
        style={{
          position: 'absolute',
          top: 48,
          left: 48,
          maxWidth: 260,
          backgroundColor: 'transparent',
        }}
      >
        {brandLogo ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image */}
            <Image src={brandLogo} style={{ width: 128, height: 42, objectFit: 'contain' }} />
          </>
        ) : (
          <>
            <Text style={{ fontSize: 10, fontWeight: 600, color: COLORS.primaryDark, letterSpacing: 2 }}>АВАТЕРРА</Text>
            <Text style={{ fontSize: 6.5, color: COLORS.muted, marginTop: 2 }}>Школа мышечного тестирования</Text>
          </>
        )}
      </View>
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
