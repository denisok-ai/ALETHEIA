/**
 * Каталог коротких вертикальных роликов школы (T4.4 плана SEO/соцсети, 16.10).
 *
 * В репозитории — ТОЛЬКО метаданные. Сами mp4 и постеры лежат на сервере в
 * /opt/ALETHEIA/public/uploads/clips/ (заливка: scripts/clips-upload.sh) и отдаются
 * по https://avaterra.pro/uploads/clips/... Причина: репозиторий публичный, файлы тяжёлые,
 * а ролики собраны из платного курса (см. CLAUDE.md, правило про публичный репозиторий).
 *
 * Поля:
 * - file — имя mp4 в uploads/clips/;
 * - poster — имя постера без расширения: uploads/clips/posters/<poster>.jpg (и .webp);
 * - placements — где показывать: 'practicum' (лендинг практикума) и/или slug термина глоссария.
 */

export type VideoClip = {
  slug: string;
  title: string;
  description: string;
  /** Имя файла mp4 в uploads/clips/. */
  file: string;
  /** Имя постера без расширения, в uploads/clips/posters/. */
  poster: string;
  durationSec: number;
  width: number;
  height: number;
  /** Дата публикации с часовым поясом МСК, ISO 8601. */
  uploadDate: string;
  /** 'practicum' или slug термина глоссария. */
  placements: readonly string[];
};

/** Публичный путь каталога роликов (относительно origin сайта). */
export const CLIPS_PUBLIC_DIR = '/uploads/clips';

export const VIDEO_CLIPS: readonly VideoClip[] = [
  {
    slug: '05-telo-umeet-razgruzhatsya',
    title: 'Тело умеет разгружаться',
    description:
      'Почему систему важно уметь разгружать и почему этому обычно не учат. Короткая мысль из практикума «Тело знает всё».',
    file: '05-telo-umeet-razgruzhatsya.mp4',
    poster: '05-telo-umeet-razgruzhatsya',
    durationSec: 45,
    width: 1080,
    height: 1920,
    uploadDate: '2026-10-16T16:30:00+03:00',
    placements: ['practicum', 'stress-reaktsiya'],
  },
  {
    slug: '07-iz-chego-skladyvaetsya-praktikum',
    title: 'Из чего складывается практикум',
    description:
      'Короткий обзор: что разбирается в практикуме «Тело знает всё» — от мышечного тестирования до регресса.',
    file: '07-iz-chego-skladyvaetsya-praktikum.mp4',
    poster: '07-iz-chego-skladyvaetsya-praktikum',
    durationSec: 38,
    width: 1080,
    height: 1920,
    uploadDate: '2026-10-16T16:30:00+03:00',
    placements: ['practicum'],
  },
  // Ролик 08 «Готовы ли вы меняться?» — добавить, когда появятся mp4 и json в AVATERRA-private/clips/:
  // {
  //   slug: '08-gotovy-li-vy-menyatsya',
  //   title: 'Готовы ли вы меняться?',
  //   description: '…',
  //   file: '08-gotovy-li-vy-menyatsya.mp4',
  //   poster: '08-gotovy-li-vy-menyatsya',
  //   durationSec: 0,
  //   width: 1080,
  //   height: 1920,
  //   uploadDate: '2026-10-16T16:30:00+03:00',
  //   placements: ['practicum', 'emotsionalnyy-zaryad'],
  // },
];

/** Ролики, которые нужно показать на странице (практикум или термин глоссария). */
export function getClipsForPlacement(placement: string): VideoClip[] {
  return VIDEO_CLIPS.filter((c) => c.placements.includes(placement));
}

/** Абсолютный URL ресурса роликов для JSON-LD. base — origin без завершающего слэша. */
function absolute(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Относительный URL для тегов <video> и <img>-постера. */
export function clipSrc(clip: VideoClip): string {
  return `${CLIPS_PUBLIC_DIR}/${clip.file}`;
}

export function clipPosterSrc(clip: VideoClip, ext: 'jpg' | 'webp' = 'jpg'): string {
  return `${CLIPS_PUBLIC_DIR}/posters/${clip.poster}.${ext}`;
}

/**
 * Schema.org VideoObject для одного ролика. Все URL абсолютные — требование Google Video rich results.
 * publisher — та же организация, что в JsonLdOrganization (@id `${origin}/#organization`).
 */
export function buildVideoObject(clip: VideoClip, base: string) {
  const origin = base.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: clip.title,
    description: clip.description,
    thumbnailUrl: [
      absolute(origin, clipPosterSrc(clip, 'jpg')),
      absolute(origin, clipPosterSrc(clip, 'webp')),
    ],
    uploadDate: clip.uploadDate,
    duration: `PT${clip.durationSec}S`,
    contentUrl: absolute(origin, clipSrc(clip)),
    encodingFormat: 'video/mp4',
    inLanguage: 'ru-RU',
    isFamilyFriendly: true,
    publisher: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'Школа «Аватэрра»',
      url: origin,
    },
  };
}
