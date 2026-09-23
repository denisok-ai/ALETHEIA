/** Общие фирменные элементы: фон витринных макетов, словесный знак, логотип школы, печать. */
import path from 'path';
import { existsSync } from 'fs';
import { BRAND_LOGO_PATHS } from '../brand';
import React from 'react';
import { Text, View, Image, Svg, Path } from '@react-pdf/renderer';
import { COLORS, PDF_PAGE_H, PDF_PAGE_W } from './theme';

export function ShowcaseLayoutBackground({
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
export function CertificateWordmarkOnly({
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
export function certificateBrandLogoAbsPath(): string | null {
  for (const urlPath of BRAND_LOGO_PATHS) {
    const rel = decodeURIComponent(urlPath.replace(/^\//, ''));
    const abs = path.join(process.cwd(), 'public', rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/** Логотип как на сайте; иначе текстовый {@link CertificateWordmarkOnly}. */
export function CertificateSiteBrandMark({
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
export function HeritageSealCheckGraphic() {
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
