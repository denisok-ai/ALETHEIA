/**
 * Проверка ролика через ffprobe перед постановкой в очередь соцсетей (T3.7).
 * Образец идеи: audio-mastering-web/backend/app/social/video_check.py (там другой набор требований — Reels).
 *
 * Два слоя:
 *  - probeVideo(path) — запускает ffprobe (без shell, таймаут 20 с) и разбирает JSON в VideoMeta;
 *  - checkVideo(meta, { network }) — чистая функция: ошибки (problems) блокируют постановку,
 *    предупреждения (warnings) только показываются владельцу.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_VIDEO_LIMIT_BYTES } from './connectors/max';
import { TELEGRAM_UPLOAD_LIMIT_BYTES } from './connectors/telegram';

export type VideoNetwork = 'telegram' | 'max';
export type VideoProfile = 'vertical' | 'horizontal' | 'square';

export type VideoMeta = {
  /** Расширение файла в нижнем регистре, например «.mp4»; пустая строка — неизвестно. */
  ext: string;
  sizeBytes: number;
  durationSec: number;
  /** Ширина и высота с учётом поворота (rotate 90/270 меняет их местами). 0 — если видеопотока нет. */
  width: number;
  height: number;
  /** Кодек видеопотока (ffprobe codec_name), null — видеопотока нет. */
  videoCodec: string | null;
  /** Формат пикселя, например «yuv420p» (8 бит) или «yuv420p10le» (10 бит). */
  pixFmt: string | null;
  hasAudio: boolean;
  audioCodec: string | null;
  /** format_name из ffprobe, например «mov,mp4,m4a,3gp,3g2,mj2» или «matroska,webm». */
  container: string;
};

export type VideoCheck = {
  ok: boolean;
  profile: VideoProfile;
  problems: string[];
  warnings: string[];
};

export const FFPROBE_TIMEOUT_MS = 20_000;
/** Клип длиннее этого порога — предупреждение (короткие ролики school-формата 30–90 с). */
export const CLIP_MAX_SEC = 90;
/** Допуск по соотношению сторон для вертикали: ±3 % от 9:16. */
const ASPECT_TOLERANCE = 0.03;
const VERTICAL_ASPECT = 9 / 16;
/** Расширения, которые принимает MAX (коннектор проверяет то же самое до сети). */
const MAX_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm']);
/** Подстроки format_name, по которым узнаём контейнер, принимаемый MAX. */
const MAX_CONTAINER_MARKERS = ['mp4', 'mov', 'matroska', 'webm'];

export const FFPROBE_NOT_INSTALLED = 'ffprobe не установлен: нет в PATH. Установите ffmpeg (в Debian/Ubuntu: apt install ffmpeg).';

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  duration?: string;
  tags?: Record<string, string>;
  side_data_list?: Array<{ rotation?: number }>;
};

type FfprobeOutput = {
  streams?: FfprobeStream[];
  format?: { format_name?: string; duration?: string; size?: string };
};

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Поворот из тегов или side_data: ffprobe отдаёт его для роликов, снятых телефоном. */
function rotationOf(stream: FfprobeStream): number {
  const fromTag = toNumber(stream.tags?.rotate);
  if (fromTag) return fromTag;
  const side = stream.side_data_list?.find((s) => typeof s.rotation === 'number');
  return side?.rotation ? Math.abs(side.rotation) : 0;
}

/**
 * Разбор JSON-вывода `ffprobe -print_format json -show_format -show_streams`.
 * Чистая функция: сеть и диск не трогает. Отсутствие видеопотока — не ошибка разбора:
 * videoCodec станет null, а checkVideo сообщит об этом.
 * sizeBytes берётся из format.size; если его нет, используется fallbackSizeBytes.
 */
export function parseFfprobeOutput(json: unknown, ext: string, fallbackSizeBytes = 0): VideoMeta {
  const data = (json ?? {}) as FfprobeOutput;
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const format = data.format ?? {};

  let width = toNumber(video?.width);
  let height = toNumber(video?.height);
  if (video && (rotationOf(video) === 90 || rotationOf(video) === 270)) {
    [width, height] = [height, width];
  }

  return {
    ext: ext.toLowerCase(),
    sizeBytes: toNumber(format.size) || fallbackSizeBytes,
    durationSec: toNumber(format.duration) || toNumber(video?.duration),
    width,
    height,
    videoCodec: video?.codec_name ? String(video.codec_name).toLowerCase() : null,
    pixFmt: video?.pix_fmt ? String(video.pix_fmt).toLowerCase() : null,
    hasAudio: Boolean(audio),
    audioCodec: audio?.codec_name ? String(audio.codec_name).toLowerCase() : null,
    container: String(format.format_name ?? '').toLowerCase(),
  };
}

/** Запускает ffprobe над файлом. Ошибки: ffprobe не установлен, таймаут, файл не читается. */
export function probeVideo(filePath: string): Promise<VideoMeta> {
  const args = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath];
  return new Promise<VideoMeta>((resolve, reject) => {
    execFile('ffprobe', args, { timeout: FFPROBE_TIMEOUT_MS, windowsHide: true }, (err, stdout, stderr) => {
      const name = path.basename(filePath);
      if (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') return reject(new Error(FFPROBE_NOT_INSTALLED));
        if ((err as { killed?: boolean }).killed) {
          return reject(new Error(`ffprobe не ответил за ${FFPROBE_TIMEOUT_MS / 1000} с: файл «${name}»`));
        }
        const detail = String(stderr ?? '').trim().split('\n')[0] || err.message;
        return reject(new Error(`ffprobe не смог прочитать файл «${name}»: ${detail}`));
      }
      let json: unknown;
      try {
        json = JSON.parse(String(stdout));
      } catch {
        return reject(new Error(`ffprobe вернул не JSON для файла «${name}»`));
      }
      fs.stat(filePath)
        .then((st) => resolve(parseFfprobeOutput(json, path.extname(filePath), st.size)))
        .catch(() => resolve(parseFfprobeOutput(json, path.extname(filePath), 0)));
    });
  });
}

/** Профиль по сторонам: квадрат — в пределах допуска, иначе вертикаль (h > w) или горизонталь. */
export function profileOf(width: number, height: number): VideoProfile {
  if (width <= 0 || height <= 0) return 'horizontal'; // размеров нет: ошибка уже в problems
  if (Math.abs(width / height - 1) <= ASPECT_TOLERANCE) return 'square';
  return height > width ? 'vertical' : 'horizontal';
}

/**
 * Проверка метаданных ролика под сеть. Ошибки блокируют постановку в очередь,
 * предупреждения только печатаются.
 */
export function checkVideo(meta: VideoMeta, opts: { network: VideoNetwork }): VideoCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  const profile = profileOf(meta.width, meta.height);
  const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;

  if (opts.network === 'telegram') {
    if (meta.sizeBytes > TELEGRAM_UPLOAD_LIMIT_BYTES) {
      problems.push(`ролик ${mb(meta.sizeBytes)} МБ: больше лимита Telegram ${mb(TELEGRAM_UPLOAD_LIMIT_BYTES)} МБ`);
    }
  } else {
    if (meta.sizeBytes > MAX_VIDEO_LIMIT_BYTES) {
      problems.push(`ролик ${mb(meta.sizeBytes)} МБ: больше лимита MAX ${mb(MAX_VIDEO_LIMIT_BYTES)} МБ`);
    }
    const extOk = meta.ext === '' || MAX_VIDEO_EXTENSIONS.has(meta.ext);
    const containerOk = MAX_CONTAINER_MARKERS.some((m) => meta.container.includes(m));
    if (!extOk || (meta.container !== '' && !containerOk)) {
      problems.push(`формат «${meta.ext || meta.container}» не принимает MAX: нужны mp4, mov, mkv, webm`);
    }
  }

  if (meta.videoCodec === null) {
    problems.push('в файле нет видеопотока');
  }
  if (meta.durationSec <= 0) {
    problems.push('длительность 0 с: файл не содержит проигрываемого ролика');
  }

  if (profile === 'vertical' && Math.abs(meta.width / meta.height - VERTICAL_ASPECT) / VERTICAL_ASPECT > ASPECT_TOLERANCE) {
    warnings.push(`вертикаль ${meta.width}×${meta.height} не 9:16 (допуск ±3 %)`);
  }
  if (meta.durationSec > CLIP_MAX_SEC) {
    warnings.push(`длительность ${Math.round(meta.durationSec)} с: клип длиннее ${CLIP_MAX_SEC} с`);
  }
  if (meta.videoCodec !== null) {
    if (!meta.hasAudio) {
      warnings.push('в ролике нет звуковой дорожки');
    }
    if (meta.videoCodec !== 'h264') {
      warnings.push(`кодек видео ${meta.videoCodec}: Telegram на части клиентов не проигрывает ролик inline, нужен H.264`);
    }
    if (meta.pixFmt !== null && meta.pixFmt !== 'yuv420p') {
      warnings.push(`формат пикселя ${meta.pixFmt} (не 8-бит yuv420p): на части телефонов такой H.264 не воспроизводится`);
    }
  }

  return { ok: problems.length === 0, profile, problems, warnings };
}
