/**
 * JSON-LD страницы /about: ProfilePage с главной сущностью Person.
 * Проверяем структуру уже отрисованного скрипта, без рендера DOM.
 */
import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { JsonLdProfilePage } from '@/components/JsonLdProfilePage';
import { jsonLdString } from '@/lib/json-ld';

const PAGE = 'https://avaterra.pro/about';

function renderedData(): Record<string, unknown> {
  const el = JsonLdProfilePage({
    id: `${PAGE}#person`,
    name: 'Татьяна Стрельцова',
    description: 'Описание <script>alert(1)</script>',
    url: PAGE,
    imageUrl: 'https://avaterra.pro/images/tatiana/tatiana-about.png',
    jobTitle: 'Основательница школы кинезиологии АВАТЕРРА',
    dateModified: '2026-10-13',
    sameAs: ['https://t.me/avaterrapro', 'https://www.youtube.com/@avaterra'],
    knowsAbout: ['мышечное тестирование'],
    worksFor: 'https://avaterra.pro/#organization',
  }) as ReactElement<{ type: string; dangerouslySetInnerHTML: { __html: string } }>;
  expect(el.type).toBe('script');
  expect(el.props.type).toBe('application/ld+json');
  return JSON.parse(el.props.dangerouslySetInnerHTML.__html) as Record<string, unknown>;
}

describe('JsonLdProfilePage (/about)', () => {
  it('верхний уровень — ProfilePage с датой правки и языком', () => {
    const data = renderedData();
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('ProfilePage');
    expect(data.url).toBe(PAGE);
    expect(data.dateModified).toBe('2026-10-13');
    expect(data.inLanguage).toBe('ru-RU');
  });

  it('mainEntity — Person с тем же @id, что на других страницах (граф не раздваивается)', () => {
    const person = renderedData().mainEntity as Record<string, unknown>;
    expect(person['@type']).toBe('Person');
    expect(person['@id']).toBe('https://avaterra.pro/about#person');
    expect(person['@context']).toBeUndefined();
    expect(person.name).toBe('Татьяна Стрельцова');
    expect(person.jobTitle).toBe('Основательница школы кинезиологии АВАТЕРРА');
    expect(person.url).toBe(PAGE);
    expect(person.image).toBe('https://avaterra.pro/images/tatiana/tatiana-about.png');
    expect(person.sameAs).toEqual(['https://t.me/avaterrapro', 'https://www.youtube.com/@avaterra']);
    expect(person.knowsAbout).toEqual(['мышечное тестирование']);
    expect(person.worksFor).toEqual({ '@id': 'https://avaterra.pro/#organization' });
  });

  it('пустые необязательные списки не попадают в разметку', () => {
    const el = JsonLdProfilePage({
      id: `${PAGE}#person`,
      name: 'Имя',
      description: 'Описание',
      url: PAGE,
      imageUrl: 'https://avaterra.pro/a.png',
      jobTitle: 'Должность',
      dateModified: '2026-10-13',
      sameAs: [],
    }) as ReactElement<{ dangerouslySetInnerHTML: { __html: string } }>;
    const person = (JSON.parse(el.props.dangerouslySetInnerHTML.__html) as { mainEntity: Record<string, unknown> })
      .mainEntity;
    expect(person).not.toHaveProperty('sameAs');
    expect(person).not.toHaveProperty('knowsAbout');
    expect(person).not.toHaveProperty('worksFor');
  });

  it('разметка безопасна внутри <script>: угловые скобки экранированы', () => {
    const el = JsonLdProfilePage({
      id: `${PAGE}#person`,
      name: 'Имя',
      description: 'Описание <script>alert(1)</script>',
      url: PAGE,
      imageUrl: 'https://avaterra.pro/a.png',
      jobTitle: 'Должность',
      dateModified: '2026-10-13',
    }) as ReactElement<{ dangerouslySetInnerHTML: { __html: string } }>;
    const html = el.props.dangerouslySetInnerHTML.__html;
    expect(html).not.toContain('<');
    expect(html).not.toContain('>');
    expect(jsonLdString({ a: '<' })).toBe('{"a":"\\u003c"}');
  });
});
