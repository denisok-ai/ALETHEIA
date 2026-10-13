/**
 * Метки ?ref=<сеть>-<NN>: валидация, код сети по метке, ссылка с меткой.
 */
import { describe, expect, it } from 'vitest';
import {
  isValidRefCode,
  networkForRef,
  refCodeFor,
  refFromValue,
  trackedUrl,
} from '@/lib/social/refs';

describe('ref: валидация метки', () => {
  it.each(['tg-01', 'vk-03', 'yt-02', 'rt-01', 'dz-01', 'ig-01', 'tg-001'])('принимает %s', (ref) => {
    expect(isValidRefCode(ref)).toBe(true);
  });

  it.each([
    '',
    'tg',
    'tg-1', // одна цифра
    'tg-1234', // четыре цифры
    'TG-01', // заглавные
    'tg_01',
    'tg-01 ',
    ' tg-01',
    'tg-01;drop',
    'tg-01&x=1',
    'телеграм-01',
    '1g-01',
  ])('отвергает %j', (ref) => {
    expect(isValidRefCode(ref)).toBe(false);
  });

  it('refFromValue отдаёт null для мусора и метку для корректного значения', () => {
    expect(refFromValue(null)).toBeNull();
    expect(refFromValue(undefined)).toBeNull();
    expect(refFromValue('<script>')).toBeNull();
    expect(refFromValue('vk-03')).toBe('vk-03');
  });
});

describe('ref: сеть по метке', () => {
  it('сопоставляет префиксы с кодами сетей', () => {
    expect(networkForRef('tg-01')).toBe('telegram');
    expect(networkForRef('vk-03')).toBe('vk');
    expect(networkForRef('yt-02')).toBe('youtube');
    expect(networkForRef('rt-01')).toBe('rutube');
    expect(networkForRef('dz-01')).toBe('dzen');
    expect(networkForRef('ig-01')).toBe('instagram');
  });

  it('неизвестный префикс и некорректная метка дают null', () => {
    expect(networkForRef('fb-01')).toBeNull();
    expect(networkForRef('TG-01')).toBeNull();
    expect(networkForRef('tg-1')).toBeNull();
  });
});

describe('ref: метка материала в сети', () => {
  it('формирует код с двузначным номером', () => {
    expect(refCodeFor('telegram', 1)).toBe('tg-01');
    expect(refCodeFor('vk', 3)).toBe('vk-03');
    expect(refCodeFor('youtube', 12)).toBe('yt-12');
    expect(refCodeFor('dzen', 999)).toBe('dz-999');
  });

  it('неизвестная сеть и номер вне 1..999 — ошибка вызова', () => {
    expect(() => refCodeFor('facebook', 1)).toThrow(/unknown network/);
    expect(() => refCodeFor('vk', 0)).toThrow();
    expect(() => refCodeFor('vk', 1000)).toThrow();
    expect(() => refCodeFor('vk', 1.5)).toThrow();
  });

  it('созданная метка проходит валидацию и даёт ту же сеть', () => {
    for (const network of ['telegram', 'vk', 'youtube', 'rutube', 'dzen', 'instagram']) {
      const code = refCodeFor(network, 7);
      expect(isValidRefCode(code)).toBe(true);
      expect(networkForRef(code)).toBe(network);
    }
  });
});

describe('trackedUrl: ссылка с меткой', () => {
  it('добавляет ref к пути без query', () => {
    expect(trackedUrl('https://avaterra.pro/lufs-checker', 'tg-01')).toBe(
      'https://avaterra.pro/lufs-checker?ref=tg-01',
    );
  });

  it('сохраняет существующий query и порядок параметров', () => {
    expect(trackedUrl('https://avaterra.pro/kurs?utm_source=x&b=2', 'vk-03')).toBe(
      'https://avaterra.pro/kurs?utm_source=x&b=2&ref=vk-03',
    );
  });

  it('не перекодирует чужие параметры', () => {
    expect(trackedUrl('https://avaterra.pro/p?q=a%20b+c', 'ig-01')).toBe(
      'https://avaterra.pro/p?q=a%20b+c&ref=ig-01',
    );
  });

  it('ставит метку перед якорем', () => {
    expect(trackedUrl('https://avaterra.pro/news#echoteka-1-2', 'tg-02')).toBe(
      'https://avaterra.pro/news?ref=tg-02#echoteka-1-2',
    );
    expect(trackedUrl('https://avaterra.pro/news?a=1#top', 'tg-02')).toBe(
      'https://avaterra.pro/news?a=1&ref=tg-02#top',
    );
  });

  it('заменяет старую метку, а не дублирует её', () => {
    expect(trackedUrl('https://avaterra.pro/p?ref=yt-01&a=1', 'tg-05')).toBe(
      'https://avaterra.pro/p?a=1&ref=tg-05',
    );
  });

  it('ошибки: некорректная метка, относительный URL, чужая схема', () => {
    expect(() => trackedUrl('https://avaterra.pro/p', 'TG-01')).toThrow(/ref code/);
    expect(() => trackedUrl('/p', 'tg-01')).toThrow(/absolute/);
    expect(() => trackedUrl('javascript:alert(1)', 'tg-01')).toThrow();
  });
});
