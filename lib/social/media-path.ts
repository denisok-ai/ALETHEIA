/**
 * Файлы роликов соцсетей лежат на сервере ВНЕ public/ (их не должно быть в сети).
 * SocialItem.mediaPath хранит имя файла относительно каталога соцсетей.
 */
import path from 'node:path';

/** Каталог по умолчанию на VPS; переопределяется SystemSetting `social_media_dir`. */
export const DEFAULT_SOCIAL_MEDIA_DIR = '/opt/ALETHEIA/private/social';

/**
 * Абсолютный путь к файлу внутри каталога соцсетей.
 * Бросает ошибку на «..», на пути вне каталога и на пустое значение. Существование файла не проверяет.
 */
export function resolveSocialMediaPath(mediaPath: string, baseDir: string): string {
  const raw = (mediaPath ?? '').trim();
  if (!raw) throw new Error('не задан путь к файлу ролика');
  if (raw.includes('\0')) throw new Error('путь к файлу содержит недопустимый символ');
  if (raw.split(/[\\/]+/).includes('..')) throw new Error('путь к файлу содержит «..»');

  const base = path.resolve(baseDir);
  const full = path.resolve(base, raw);
  const rel = path.relative(base, full);
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error('файл находится вне каталога соцсетей');
  }
  return full;
}
