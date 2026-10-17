/**
 * Подпись для Telegram (HTML): структура, экранирование, ссылка с ?ref=, лимит 1024.
 */
import { describe, expect, it } from 'vitest';
import {
  buildTelegramCaption,
  escapeTelegramHtml,
  SCHOOL_COURSE_URL,
  SCHOOL_LINK_TEXT,
  TELEGRAM_DEFAULT_HASHTAGS,
} from '@/lib/social/telegram-caption';

describe('escapeTelegramHtml', () => {
  it('экранирует только &, <, >', () => {
    expect(escapeTelegramHtml('A < B & C > D "q"')).toBe('A &lt; B &amp; C &gt; D "q"');
  });
});

describe('buildTelegramCaption: структура', () => {
  it('заголовок жирным, тело, ссылка с меткой, хештеги — в этом порядке', () => {
    const { caption, warnings } = buildTelegramCaption({
      title: 'Мышцы и нервная система',
      body: 'Короткое объяснение.',
      refCode: 'tg-01',
    });
    expect(warnings).toEqual([]);
    const expectedLink = `<a href="${SCHOOL_COURSE_URL}?ref=tg-01">${SCHOOL_LINK_TEXT}</a>`;
    expect(caption).toBe(
      [
        '<b>Мышцы и нервная система</b>',
        '',
        'Короткое объяснение.',
        '',
        expectedLink,
        '',
        TELEGRAM_DEFAULT_HASHTAGS,
      ].join('\n'),
    );
  });

  it('свои хештеги заменяют стандартные', () => {
    const { caption } = buildTelegramCaption({ title: 'Заголовок', refCode: 'tg-02', hashtags: '#тест' });
    expect(caption.endsWith('#тест')).toBe(true);
    expect(caption).not.toContain('#кинезиология');
  });

  it('без тела подпись не содержит пустого абзаца', () => {
    const { caption } = buildTelegramCaption({ title: 'Заголовок', refCode: 'tg-03' });
    expect(caption).not.toContain('\n\n\n');
    expect(caption.startsWith('<b>Заголовок</b>\n\n<a href=')).toBe(true);
  });
});

describe('buildTelegramCaption: экранирование HTML', () => {
  it('теги и амперсанд в заголовке и теле не ломают разметку', () => {
    const { caption } = buildTelegramCaption({
      title: 'Тело & <b>разум</b>',
      body: 'Скрипт <script>alert(1)</script> и 2 < 3',
      refCode: 'tg-04',
    });
    expect(caption).toContain('<b>Тело &amp; &lt;b&gt;разум&lt;/b&gt;</b>');
    expect(caption).toContain('Скрипт &lt;script&gt;alert(1)&lt;/script&gt; и 2 &lt; 3');
    expect(caption).not.toContain('<script>');
  });
});

describe('buildTelegramCaption: предупреждения и лимит', () => {
  it('подпись длиннее 1024 знаков — предупреждение', () => {
    const { warnings } = buildTelegramCaption({ title: 'Заголовок', body: 'я'.repeat(1100), refCode: 'tg-05' });
    expect(warnings.some((w) => w.includes('1024'))).toBe(true);
  });

  it('экранирование учитывается в лимите', () => {
    // 600 амперсандов превращаются в 3000 знаков &amp; — точно больше лимита.
    const { warnings } = buildTelegramCaption({ title: 'Заголовок', body: '&'.repeat(600), refCode: 'tg-06' });
    expect(warnings.some((w) => w.includes('1024'))).toBe(true);
  });

  it('частица «не» в заголовке — предупреждение (правило Татьяны)', () => {
    const { warnings } = buildTelegramCaption({ title: 'Не работает дыхание', refCode: 'tg-07' });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('запрещённая формулировка из базы знаний — предупреждение', () => {
    const { warnings } = buildTelegramCaption({
      title: 'Заголовок',
      body: 'Мы лечим спину',
      refCode: 'tg-08',
      prohibitedPhrases: ['мы лечим'],
    });
    expect(warnings.some((w) => w.includes('запрещённая формулировка'))).toBe(true);
  });

  it('некорректная метка — предупреждение, ссылка без ?ref=', () => {
    const { caption, warnings } = buildTelegramCaption({ title: 'Заголовок', refCode: 'xx' });
    expect(warnings.some((w) => w.includes('некорректна'))).toBe(true);
    expect(caption).toContain(`<a href="${SCHOOL_COURSE_URL}">`);
  });
});

describe('buildTelegramCaption: текстовый пост без медиа', () => {
  it('подпись к видео: 1100 знаков — предупреждение о лимите 1024', () => {
    const { warnings } = buildTelegramCaption({ title: 'Заголовок', body: 'я'.repeat(1100), refCode: 'tg-10' });
    expect(warnings.some((w) => w.includes('1024'))).toBe(true);
  });

  it('текст без медиа: 1100 знаков проходят, лимит Telegram — 4096', () => {
    const r = buildTelegramCaption({ title: 'Заголовок', body: 'я'.repeat(1100), refCode: 'tg-10', hasMedia: false });
    expect(r.warnings.some((w) => w.includes('1024'))).toBe(false);
    expect(r.warnings.some((w) => w.includes('4096'))).toBe(false);
  });

  it('текст без медиа: длиннее 4096 знаков — предупреждение с лимитом 4096', () => {
    const r = buildTelegramCaption({ title: 'Заголовок', body: 'я'.repeat(4200), refCode: 'tg-11', hasMedia: false });
    expect(r.warnings.some((w) => w.includes('4096'))).toBe(true);
  });

  it('MAX без медиа — лимит 4000 как и с медиа', () => {
    const r = buildTelegramCaption({ networkCode: 'max', title: 'Заголовок', body: 'я'.repeat(4100), refCode: 'mx-10', hasMedia: false });
    expect(r.warnings.some((w) => w.includes('4000'))).toBe(true);
  });
});

describe('buildTelegramCaption: ссылка из поля url очереди', () => {
  it('без url ссылка ведёт на практикум с ?ref=', () => {
    const { caption } = buildTelegramCaption({ title: 'Заголовок', refCode: 'tg-20' });
    expect(caption).toContain(`<a href="${SCHOOL_COURSE_URL}?ref=tg-20">`);
  });

  it('переданный url становится основой ссылки, ?ref= строится от него', () => {
    const url = 'https://avaterra.pro/glossary/myshechnoe-testirovanie';
    const { caption, warnings } = buildTelegramCaption({ title: 'Заголовок', refCode: 'tg-21', url });
    expect(warnings).toEqual([]);
    expect(caption).toContain(`<a href="${url}?ref=tg-21">`);
    expect(caption).not.toContain(SCHOOL_COURSE_URL);
  });

  it('у url уже есть query: ref добавляется через &, экранированный в href', () => {
    const { caption } = buildTelegramCaption({
      title: 'Заголовок',
      refCode: 'tg-22',
      url: 'https://avaterra.pro/blog/statya?utm=x',
    });
    expect(caption).toContain('<a href="https://avaterra.pro/blog/statya?utm=x&amp;ref=tg-22">');
  });

  it('якорь в url остаётся последним, ref ставится перед ним', () => {
    const { caption } = buildTelegramCaption({
      title: 'Заголовок',
      refCode: 'tg-23',
      url: 'https://avaterra.pro/glossary/x#faq',
    });
    expect(caption).toContain('<a href="https://avaterra.pro/glossary/x?ref=tg-23#faq">');
  });

  it('текст поста без url и с url — одинаковая структура, меняется только ссылка', () => {
    const plain = buildTelegramCaption({ title: 'Заголовок', body: 'Текст.', refCode: 'tg-24' });
    const withUrl = buildTelegramCaption({
      title: 'Заголовок',
      body: 'Текст.',
      refCode: 'tg-24',
      url: 'https://avaterra.pro/blog/statya',
    });
    expect(withUrl.caption.replace(/<a href="[^"]*">/, '<a>')).toBe(plain.caption.replace(/<a href="[^"]*">/, '<a>'));
  });
});
