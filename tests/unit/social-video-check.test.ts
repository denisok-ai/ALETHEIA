/**
 * Проверка ролика ffprobe (T3.7): разбор JSON, чистая checkVideo, probeVideo с подменой execFile.
 * Фикстуры — урезанный вывод ffprobe по реальным роликам школы (без путей сервера).
 */
import { execFile } from 'node:child_process';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import fixture02 from './fixtures/social-ffprobe/ffprobe-02-telo-odinakovo.json';
import fixture03 from './fixtures/social-ffprobe/ffprobe-03-diagnostika-lyubaya-situatsiya.json';
import {
  checkVideo,
  parseFfprobeOutput,
  probeVideo,
  profileOf,
  type VideoMeta,
} from '@/lib/social/video-check';

vi.mock('node:child_process', () => ({ execFile: vi.fn() }));
// Коннекторы тянут настройки (и БД) только ради токенов; для проверки ролика они не нужны.
vi.mock('@/lib/settings', () => ({ getEnvOverrides: vi.fn(async () => ({})) }));

const MB = 1024 * 1024;

/** Синтетический ролик: поля по умолчанию — годный вертикальный клип для Telegram. */
function meta(over: Partial<VideoMeta> = {}): VideoMeta {
  return {
    ext: '.mp4',
    sizeBytes: 10 * MB,
    durationSec: 45,
    width: 1080,
    height: 1920,
    videoCodec: 'h264',
    pixFmt: 'yuv420p',
    hasAudio: true,
    audioCodec: 'aac',
    container: 'mov,mp4,m4a,3gp,3g2,mj2',
    ...over,
  };
}

describe('parseFfprobeOutput: реальные выводы ffprobe', () => {
  it('02-telo-odinakovo: 8-бит H.264, 1080×1920, 52 с, стерео AAC', () => {
    const m = parseFfprobeOutput(fixture02, '.mp4');
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1920);
    expect(m.durationSec).toBeCloseTo(52.22, 2);
    expect(m.sizeBytes).toBe(14184542);
    expect(m.videoCodec).toBe('h264');
    expect(m.pixFmt).toBe('yuv420p');
    expect(m.hasAudio).toBe(true);
    expect(m.audioCodec).toBe('aac');
    expect(m.container).toContain('mp4');
  });

  it('03-diagnostika: 10-бит H.264 (yuv420p10le), 23 с', () => {
    const m = parseFfprobeOutput(fixture03, '.mp4');
    expect(m.pixFmt).toBe('yuv420p10le');
    expect(m.durationSec).toBeCloseTo(23.02, 2);
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1920);
  });

  it('поворот телефонной съёмки (rotate 90) меняет стороны местами', () => {
    const json = {
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, tags: { rotate: '90' } },
        { codec_type: 'audio', codec_name: 'aac' },
      ],
      format: { format_name: 'mov,mp4', duration: '10', size: '1000' },
    };
    const m = parseFfprobeOutput(json, '.mov');
    expect([m.width, m.height]).toEqual([1080, 1920]);
  });

  it('без видеопотока videoCodec = null, без аудио hasAudio = false', () => {
    const json = {
      streams: [{ codec_type: 'audio', codec_name: 'mp3' }],
      format: { format_name: 'mp3', duration: '30', size: '500' },
    };
    const m = parseFfprobeOutput(json, '.mp3');
    expect(m.videoCodec).toBeNull();
    expect(m.width).toBe(0);
    expect(m.hasAudio).toBe(true);
  });

  it('пустой или битый вывод не падает: нули и null', () => {
    const m = parseFfprobeOutput({}, '', 123);
    expect(m.durationSec).toBe(0);
    expect(m.sizeBytes).toBe(123);
    expect(m.videoCodec).toBeNull();
  });
});

describe('checkVideo: реальные ролики школы', () => {
  it('02-telo-odinakovo проходит проверку Telegram без предупреждений', () => {
    const res = checkVideo(parseFfprobeOutput(fixture02, '.mp4'), { network: 'telegram' });
    expect(res).toEqual({ ok: true, profile: 'vertical', problems: [], warnings: [] });
  });

  it('03-diagnostika проходит, но предупреждает про 10-бит', () => {
    const res = checkVideo(parseFfprobeOutput(fixture03, '.mp4'), { network: 'telegram' });
    expect(res.ok).toBe(true);
    expect(res.profile).toBe('vertical');
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toContain('yuv420p10le');
  });
});

describe('checkVideo: синтетика', () => {
  it('слишком большой для Telegram (60 МБ) — ошибка; для MAX (лимит 250 МБ) — нет', () => {
    const big = meta({ sizeBytes: 60 * MB });
    const tg = checkVideo(big, { network: 'telegram' });
    expect(tg.ok).toBe(false);
    expect(tg.problems.join(' ')).toContain('50');
    expect(checkVideo(big, { network: 'max' }).ok).toBe(true);
  });

  it('не 9:16 вертикаль — предупреждение; в пределах ±3 % — молча', () => {
    const wide = checkVideo(meta({ width: 1080, height: 1350 }), { network: 'telegram' });
    expect(wide.profile).toBe('vertical');
    expect(wide.warnings.join(' ')).toContain('не 9:16');
    expect(checkVideo(meta({ width: 1080, height: 1910 }), { network: 'telegram' }).warnings).toEqual([]);
  });

  it('горизонталь 16:9 допустима без предупреждений о пропорции', () => {
    const res = checkVideo(meta({ width: 1920, height: 1080 }), { network: 'telegram' });
    expect(res.ok).toBe(true);
    expect(res.profile).toBe('horizontal');
    expect(res.warnings).toEqual([]);
  });

  it('без звука — предупреждение, не ошибка', () => {
    const res = checkVideo(meta({ hasAudio: false, audioCodec: null }), { network: 'telegram' });
    expect(res.ok).toBe(true);
    expect(res.warnings).toContain('в ролике нет звуковой дорожки');
  });

  it('нет видеопотока — ошибка', () => {
    const res = checkVideo(meta({ videoCodec: null, width: 0, height: 0 }), { network: 'telegram' });
    expect(res.ok).toBe(false);
    expect(res.problems).toContain('в файле нет видеопотока');
  });

  it('длительность 0 — ошибка; больше 90 с — предупреждение', () => {
    expect(checkVideo(meta({ durationSec: 0 }), { network: 'telegram' }).ok).toBe(false);
    const long = checkVideo(meta({ durationSec: 120 }), { network: 'telegram' });
    expect(long.ok).toBe(true);
    expect(long.warnings.join(' ')).toContain('длиннее 90');
  });

  it('кодек не h264 — предупреждение для Telegram', () => {
    const res = checkVideo(meta({ videoCodec: 'hevc' }), { network: 'telegram' });
    expect(res.ok).toBe(true);
    expect(res.warnings.join(' ')).toContain('hevc');
  });

  it('MAX: контейнер вне mp4/mov/mkv/webm — ошибка', () => {
    const avi = checkVideo(meta({ ext: '.avi', container: 'avi' }), { network: 'max' });
    expect(avi.ok).toBe(false);
    expect(avi.problems.join(' ')).toContain('MAX');
    expect(checkVideo(meta({ ext: '.webm', container: 'matroska,webm' }), { network: 'max' }).ok).toBe(true);
  });
});

describe('profileOf', () => {
  it('квадрат в допуске, вертикаль по высоте, горизонталь иначе', () => {
    expect(profileOf(1000, 1000)).toBe('square');
    expect(profileOf(1000, 1020)).toBe('square');
    expect(profileOf(1080, 1920)).toBe('vertical');
    expect(profileOf(1920, 1080)).toBe('horizontal');
  });
});

describe('probeVideo: запуск ffprobe', () => {
  const execFileMock = vi.mocked(execFile);

  /** Подмена execFile: вызывает колбэк с заданными ошибкой и stdout. */
  function mockExec(err: (Error & { code?: string; killed?: boolean }) | null, stdout = '', stderr = '') {
    execFileMock.mockImplementation(((_cmd: string, _args: string[], _opts: unknown, cb: (...a: unknown[]) => void) => {
      cb(err, stdout, stderr);
    }) as unknown as typeof execFile);
  }

  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('ENOENT → понятная ошибка «ffprobe не установлен»', async () => {
    const enoent = Object.assign(new Error('spawn ffprobe ENOENT'), { code: 'ENOENT' });
    mockExec(enoent);
    await expect(probeVideo('/x/ролик.mp4')).rejects.toThrow('ffprobe не установлен');
  });

  it('вызывает ffprobe без shell, с путём аргументом и таймаутом 20 с', async () => {
    mockExec(null, JSON.stringify(fixture02));
    const m = await probeVideo('/x/02.mp4');
    expect(m.width).toBe(1080);
    const [cmd, args, opts] = execFileMock.mock.calls[0] as unknown as [string, string[], { timeout: number; shell?: boolean }];
    expect(cmd).toBe('ffprobe');
    expect(args).toEqual(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '/x/02.mp4']);
    expect(opts.timeout).toBe(20_000);
    expect(opts.shell).toBeUndefined();
  });

  it('таймаут → сообщение с секундами', async () => {
    mockExec(Object.assign(new Error('killed'), { killed: true }));
    await expect(probeVideo('/x/a.mp4')).rejects.toThrow('не ответил за 20 с');
  });

  it('ошибка чтения файла → сообщение с первой строкой stderr', async () => {
    mockExec(new Error('exit 1'), '', 'Invalid data found when processing input\nmore');
    await expect(probeVideo('/x/a.mp4')).rejects.toThrow('Invalid data found');
  });

  it('вывод не JSON → понятная ошибка', async () => {
    mockExec(null, 'не json');
    await expect(probeVideo('/x/a.mp4')).rejects.toThrow('не JSON');
  });
});
