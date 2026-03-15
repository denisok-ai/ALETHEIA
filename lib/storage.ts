/**
 * Абстракция хранилища файлов. Сейчас — локальный диск (public/uploads, uploads).
 * Для масштабирования (несколько инстансов, Vercel) заменить на S3/R2/Cloudflare.
 */
import path from 'path';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const UPLOADS_ROOT = process.cwd();

/**
 * Сохранить файл по относительному пути (например uploads/certificates/xxx.pdf).
 * Создаёт директории при необходимости.
 */
export async function storageWrite(relativePath: string, buffer: Buffer): Promise<void> {
  const fullPath = path.join(UPLOADS_ROOT, relativePath);
  const dir = path.dirname(fullPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(fullPath, buffer);
}

/**
 * Прочитать файл по относительному пути. Возвращает null если файла нет.
 */
export async function storageRead(relativePath: string): Promise<Buffer | null> {
  const fullPath = path.join(UPLOADS_ROOT, relativePath);
  if (!existsSync(fullPath)) return null;
  try {
    return await readFile(fullPath);
  } catch {
    return null;
  }
}

export function storageExists(relativePath: string): boolean {
  return existsSync(path.join(UPLOADS_ROOT, relativePath));
}
