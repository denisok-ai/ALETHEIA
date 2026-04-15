import type { MetadataRoute } from 'next';
import { BRAND_LOGO_URL } from '@/lib/brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'АВАТЕРРА — школа мышечного тестирования',
    short_name: 'АВАТЕРРА',
    description:
      'Курс по обучению мышечному тестированию. Как найти причину проблемы за 30 секунд. Школа AVATERRA.',
    start_url: '/',
    display: 'browser',
    background_color: '#0A0E27',
    theme_color: '#2D1B4E',
    lang: 'ru',
    icons: [
      {
        src: BRAND_LOGO_URL,
        type: 'image/png',
        sizes: 'any',
        purpose: 'any',
      },
    ],
  };
}
