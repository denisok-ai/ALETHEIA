/** Загрузчик SEO-секретов: приоритет env, парсинг файла, статус только булевыми. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getSeoSecret,
  parseSecretsEnv,
  resetSeoSecretsCache,
  seoSecretsStatus,
  SEO_SECRET_KEYS,
} from '@/lib/seo/secrets';

let dir: string;
let file: string;

function writeSecrets(content: string) {
  fs.writeFileSync(file, content, 'utf8');
  resetSeoSecretsCache();
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-secrets-'));
  file = path.join(dir, 'seo.env');
  process.env.SEO_SECRETS_FILE = file;
  for (const k of SEO_SECRET_KEYS) delete process.env[k];
  resetSeoSecretsCache();
});

afterEach(() => {
  delete process.env.SEO_SECRETS_FILE;
  for (const k of SEO_SECRET_KEYS) delete process.env[k];
  resetSeoSecretsCache();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('getSeoSecret: порядок источников', () => {
  it('env важнее файла', () => {
    writeSecrets('CRUX_API_KEY=from-file\n');
    process.env.CRUX_API_KEY = 'from-env';
    expect(getSeoSecret('CRUX_API_KEY')).toBe('from-env');
  });

  it('пустая переменная окружения не перекрывает файл', () => {
    writeSecrets('CRUX_API_KEY=from-file\n');
    process.env.CRUX_API_KEY = '   ';
    expect(getSeoSecret('CRUX_API_KEY')).toBe('from-file');
  });

  it('без env берётся из файла', () => {
    writeSecrets('CRUX_API_KEY=from-file\n');
    expect(getSeoSecret('CRUX_API_KEY')).toBe('from-file');
  });

  it('файл кешируется до сброса кеша', () => {
    writeSecrets('CRUX_API_KEY=first\n');
    expect(getSeoSecret('CRUX_API_KEY')).toBe('first');
    fs.writeFileSync(file, 'CRUX_API_KEY=second\n', 'utf8');
    expect(getSeoSecret('CRUX_API_KEY')).toBe('first');
    resetSeoSecretsCache();
    expect(getSeoSecret('CRUX_API_KEY')).toBe('second');
  });
});

describe('парсинг файла', () => {
  it('пропускает комментарии и пустые строки, обрезает пробелы', () => {
    writeSecrets(
      [
        '# комментарий',
        '',
        '   ',
        '  YANDEX_OAUTH_CLIENT_ID =  abc  ',
        '#CRUX_API_KEY=commented',
        'CRUX_API_KEY=key-1',
      ].join('\n')
    );
    expect(getSeoSecret('YANDEX_OAUTH_CLIENT_ID')).toBe('abc');
    expect(getSeoSecret('CRUX_API_KEY')).toBe('key-1');
  });

  it('снимает парные кавычки, непарные оставляет', () => {
    const parsed = parseSecretsEnv(['A="double"', "B='single'", 'C="open', 'D=plain'].join('\n'));
    expect(parsed.get('A')).toBe('double');
    expect(parsed.get('B')).toBe('single');
    expect(parsed.get('C')).toBe('"open');
    expect(parsed.get('D')).toBe('plain');
  });

  it('значение с «=» внутри сохраняется целиком', () => {
    writeSecrets('GOOGLE_OAUTH_CLIENT_SECRET=abc==\r\n');
    expect(getSeoSecret('GOOGLE_OAUTH_CLIENT_SECRET')).toBe('abc==');
  });

  it('поддерживает CRLF', () => {
    writeSecrets('CRUX_API_KEY=crlf\r\nGOOGLE_OAUTH_REFRESH_TOKEN=rt\r\n');
    expect(getSeoSecret('CRUX_API_KEY')).toBe('crlf');
    expect(getSeoSecret('GOOGLE_OAUTH_REFRESH_TOKEN')).toBe('rt');
  });
});

describe('отсутствующий файл', () => {
  it('возвращает null, не бросает исключение', () => {
    expect(getSeoSecret('CRUX_API_KEY')).toBeNull();
  });

  it('пустой ключ в файле — null', () => {
    writeSecrets('CRUX_API_KEY=\n');
    expect(getSeoSecret('CRUX_API_KEY')).toBeNull();
  });
});

describe('seoSecretsStatus: только булевы значения', () => {
  it('возвращает ключ для каждого секрета и boolean без значений', () => {
    writeSecrets('CRUX_API_KEY=super-secret-value\n');
    process.env.YANDEX_WEBMASTER_TOKEN = 'env-secret-value';
    const status = seoSecretsStatus();

    expect(Object.keys(status).sort()).toEqual([...SEO_SECRET_KEYS].sort());
    for (const k of SEO_SECRET_KEYS) {
      expect(typeof status[k]).toBe('boolean');
    }
    expect(status.CRUX_API_KEY).toBe(true);
    expect(status.YANDEX_WEBMASTER_TOKEN).toBe(true);
    expect(status.GOOGLE_OAUTH_CLIENT_ID).toBe(false);

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('super-secret-value');
    expect(serialized).not.toContain('env-secret-value');
  });

  it('без файла и env все ключи false', () => {
    const status = seoSecretsStatus();
    expect(Object.values(status).every((v) => v === false)).toBe(true);
  });
});
