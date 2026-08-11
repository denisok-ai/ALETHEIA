/**
 * OG-карточка статьи блога 1200×630 (next/og → satori).
 *
 * Зачем: у статей без собственной картинки в соцсетях/мессенджерах была одна
 * общая заглушка — карточка с заголовком заметно повышает CTR шаринга.
 *
 * Шрифты: satori не умеет woff2, поэтому берём woff из @fontsource/noto-sans —
 * тот же пакет уже используют сертификаты (lib/certificates.tsx). Сабсеты
 * cyrillic и latin подключаются как разные семьи: в cyrillic-сабсете нет
 * латинских глифов, а в заголовках встречается латиница (и «avaterra.pro»).
 */
// Явный импорт React: Next компилирует JSX через automatic runtime, но
// tsx-скрипты (локальный рендер-тест) — через classic, где нужен React в scope.
import React from 'react';
import { ImageResponse } from 'next/og';
import { readFileSync } from 'fs';
import path from 'path';

const FONT_DIR = path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans', 'files');

type FontEntry = {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: 'normal';
};

let fontsCache: FontEntry[] | null = null;

function loadFonts(): FontEntry[] {
  if (fontsCache) return fontsCache;
  const read = (file: string) => readFileSync(path.join(FONT_DIR, file));
  fontsCache = [
    { name: 'NotoCyr', data: read('noto-sans-cyrillic-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'NotoCyr', data: read('noto-sans-cyrillic-700-normal.woff'), weight: 700, style: 'normal' },
    { name: 'NotoLat', data: read('noto-sans-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'NotoLat', data: read('noto-sans-latin-700-normal.woff'), weight: 700, style: 'normal' },
  ];
  return fontsCache;
}

/** Размер шрифта заголовка под длину: длинные заголовки не должны вылезать за карточку. */
function titleFontSize(len: number): number {
  if (len <= 45) return 64;
  if (len <= 75) return 56;
  if (len <= 105) return 48;
  return 42;
}

const MAX_TITLE_CHARS = 140;

export function renderBlogCard(rawTitle: string): ImageResponse {
  const title =
    rawTitle.length > MAX_TITLE_CHARS ? `${rawTitle.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…` : rawTitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 78%, #2A3A55 100%)',
          color: '#F4F4F6',
          fontFamily: 'NotoCyr, NotoLat',
          position: 'relative',
        }}
      >
        {/* декоративный акцент */}
        <div
          style={{
            position: 'absolute',
            right: -140,
            top: -140,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: 'rgba(206, 143, 176, 0.16)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -60,
            top: -60,
            width: 240,
            height: 240,
            borderRadius: 9999,
            background: 'rgba(206, 143, 176, 0.18)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: '#CE8FB0',
              display: 'flex',
            }}
          />
          <span
            style={{
              fontSize: 26,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#D0C3AB',
            }}
          >
            Аватэрра · Блог школы
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: titleFontSize(title.length),
            fontWeight: 700,
            lineHeight: 1.18,
            maxWidth: 980,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(208, 195, 171, 0.35)',
            paddingTop: 28,
          }}
        >
          <span style={{ fontSize: 28, color: '#CE8FB0', fontWeight: 700 }}>avaterra.pro</span>
          <span style={{ fontSize: 24, color: '#D0C3AB' }}>Тело помнит всё</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: loadFonts(),
      headers: {
        // Карточка меняется только вместе с заголовком статьи — сутки кэша
        // достаточно, чтобы скраперы соцсетей не генерировали её на каждый хит.
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    }
  );
}
