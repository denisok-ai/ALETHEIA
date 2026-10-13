/**
 * Подписи постов по сетям: шаблон, ссылка с меткой, хештеги, проверки правил школы.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCaption,
  hashtagsFor,
  hashtagsOf,
  linkTextFor,
  prohibitedWarnings,
  titleProblems,
} from '@/lib/social/captions';

const URL_BASE = 'https://avaterra.pro/blog/why-is-my-suno-song-so-quiet';

describe('титулы: частица «не» (правило Татьяны)', () => {
  it('ловит «не» отдельным словом в любом регистре', () => {
    expect(titleProblems('Не работает дыхание')).toHaveLength(1);
    expect(titleProblems('Тело — не враг')).toHaveLength(1);
    expect(titleProblems('Почему НЕ получается расслабиться')).toHaveLength(1);
    expect(titleProblems('Что делать, не зная причины')).toHaveLength(1);
  });

  it('не срабатывает на «не» внутри слов и на другие слова', () => {
    expect(titleProblems('Нервная система и нет боли')).toEqual([]);
    expect(titleProblems('Новый курс: снимаем напряжение')).toEqual([]);
    expect(titleProblems('Неделя практики')).toEqual([]);
    expect(titleProblems('Ноги и спина')).toEqual([]);
    expect(titleProblems('')).toEqual([]);
  });
});

describe('запрещённые формулировки', () => {
  const phrases = ['мы вылечим', 'гарантированный результат', 'не нужны? врач'];

  it('находит фразы из базы знаний, в том числе регулярные выражения', () => {
    expect(prohibitedWarnings('Мы вылечим боль за неделю', phrases)).toHaveLength(1);
    expect(prohibitedWarnings('Нужен ли врач? Не нужны врач', phrases)).toHaveLength(1);
  });

  it('пустой список и битый шаблон не падают', () => {
    expect(prohibitedWarnings('что угодно', [])).toEqual([]);
    expect(prohibitedWarnings('скобка ( здесь', ['скобка ( здесь'])).toHaveLength(1);
  });
});

describe('хештеги и ссылка по сетям', () => {
  it('убирает повторы без учёта регистра и берёт только токены с #', () => {
    expect(hashtagsOf('#suno #Suno слово #aimusic #')).toEqual(['#suno', '#aimusic']);
  });

  it('YouTube добавляет #shorts, остальные сети — нет', () => {
    expect(hashtagsFor('youtube', '#кинезиология')).toEqual(['#кинезиология', '#shorts']);
    expect(hashtagsFor('youtube', '#shorts #a')).toEqual(['#shorts', '#a']);
    expect(hashtagsFor('vk', '#a')).toEqual(['#a']);
  });

  it('в Instagram вместо ссылки — «Ссылка в профиле»', () => {
    expect(linkTextFor('instagram', 'https://x.test/?ref=ig-01')).toBe('Ссылка в профиле');
    expect(linkTextFor('telegram', 'https://x.test/?ref=tg-01')).toBe('https://x.test/?ref=tg-01');
  });
});

describe('buildCaption', () => {
  it('собирает подпись по умолчанию с ссылкой с меткой и хештегами', () => {
    const r = buildCaption({
      networkCode: 'telegram',
      title: 'Почему тихая песня',
      body: 'Короткий текст про громкость.',
      url: URL_BASE,
      refCode: 'tg-01',
      hashtags: '#suno #музыка',
    });
    expect(r.link).toBe(`${URL_BASE}?ref=tg-01`);
    expect(r.caption).toBe(
      `Почему тихая песня\n\nКороткий текст про громкость.\n\n${URL_BASE}?ref=tg-01\n#suno #музыка`,
    );
    expect(r.warnings).toEqual([]);
  });

  it('пустые плейсхолдеры не оставляют лишних пустых строк', () => {
    const r = buildCaption({
      networkCode: 'vk',
      title: 'Заголовок',
      url: URL_BASE,
      refCode: 'vk-02',
    });
    expect(r.caption).toBe(`Заголовок\n\n${URL_BASE}?ref=vk-02`);
    expect(r.warnings).toEqual([]);
  });

  it('Instagram получает «Ссылку в профиле», а не URL', () => {
    const r = buildCaption({
      networkCode: 'instagram',
      title: 'Заголовок',
      url: URL_BASE,
      refCode: 'ig-01',
      hashtags: '#a',
    });
    expect(r.caption).toContain('Ссылка в профиле');
    expect(r.caption).not.toContain('http');
    expect(r.link).toBe(`${URL_BASE}?ref=ig-01`);
  });

  it('YouTube: #shorts в конце хештегов', () => {
    const r = buildCaption({
      networkCode: 'youtube',
      title: 'Заголовок',
      url: URL_BASE,
      refCode: 'yt-01',
      hashtags: '#a',
    });
    expect(r.caption.endsWith('#a #shorts')).toBe(true);
  });

  it('свой шаблон и подстановка значения с «$&» не ломается', () => {
    const r = buildCaption({
      networkCode: 'vk',
      title: 'Цена $& скидка',
      body: 'Текст {link} внутри',
      url: URL_BASE,
      refCode: 'vk-01',
      template: '{title} | {body} | {link}',
    });
    expect(r.caption).toBe(`Цена $& скидка | Текст {link} внутри | ${URL_BASE}?ref=vk-01`);
  });

  it('некорректная метка: предупреждение и ссылка без ?ref=, без исключения', () => {
    const r = buildCaption({
      networkCode: 'telegram',
      title: 'Заголовок',
      url: URL_BASE,
      refCode: 'TG-1',
    });
    expect(r.link).toBe(URL_BASE);
    expect(r.warnings.some((w) => /некорректна/.test(w))).toBe(true);
  });

  it('частица «не» в заголовке даёт предупреждение, подпись всё равно собирается', () => {
    const r = buildCaption({
      networkCode: 'telegram',
      title: 'Тело — не машина',
      url: URL_BASE,
      refCode: 'tg-01',
    });
    expect(r.caption).toContain('Тело — не машина');
    expect(r.warnings.some((w) => /«не»/.test(w))).toBe(true);
  });

  it('пустая подпись и слишком длинная для Telegram — предупреждения', () => {
    const empty = buildCaption({ networkCode: 'vk', title: '', url: URL_BASE, refCode: 'vk-01', template: '{title}' });
    expect(empty.warnings).toContain('подпись пустая');

    const long = buildCaption({
      networkCode: 'telegram',
      title: 'Заголовок',
      body: 'а'.repeat(1100),
      url: URL_BASE,
      refCode: 'tg-01',
    });
    expect(long.warnings.some((w) => /длиннее 1024/.test(w))).toBe(true);
  });

  it('стоп-слово школы «калибровка» заменяется, а не проходит', () => {
    const r = buildCaption({
      networkCode: 'vk',
      title: 'Заголовок',
      body: 'Сделайте калибровку тела',
      url: URL_BASE,
      refCode: 'vk-01',
    });
    expect(r.caption).not.toMatch(/калибровк/i);
  });

  it('запрещённая формулировка из базы знаний попадает в предупреждения', () => {
    const r = buildCaption({
      networkCode: 'vk',
      title: 'Заголовок',
      body: 'Мы вылечим вас от всего',
      url: URL_BASE,
      refCode: 'vk-01',
      prohibitedPhrases: ['мы вылечим'],
    });
    expect(r.warnings.some((w) => /запрещённая формулировка/.test(w))).toBe(true);
  });
});
