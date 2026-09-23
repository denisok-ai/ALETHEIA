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

import { CERTIFICATE_TEMPLATE_IDS, CERTIFICATE_TEMPLATE_LABELS, type CertificateTemplateId } from '../certificates-constants';
import React from 'react';
import { Document, Page, Text, View, Image, renderToBuffer } from '@react-pdf/renderer';
import { certificateBrandLogoAbsPath } from './brand-marks';
import { CertificateElegant, CertificateHeritage, CertificateMinimal, CertificatePrestige } from './templates-classic';
import { CertificateAwaken, CertificatePath, CertificateVitality } from './templates-showcase';
import { COLORS, FONT_FAMILY, PDF_PAGE_H, PDF_PAGE_W } from './theme';
import type { CertificateData, CertificateTextMapping } from './types';

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
    // wrap={false}: подложка растянута ровно на высоту A4, и с переносом по
    // умолчанию react-pdf выносил её на вторую страницу — сертификат выходил
    // двухстраничным. Сертификат — всегда один лист.
    <Page size="A4" wrap={false} style={{ padding: 0, fontFamily: FONT_FAMILY }}>
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


export type { CertificateTemplateId };
export { CERTIFICATE_TEMPLATE_IDS, CERTIFICATE_TEMPLATE_LABELS };
export type { CertificateData, CertificateTextMapping } from './types';
