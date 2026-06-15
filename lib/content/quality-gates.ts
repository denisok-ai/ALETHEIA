/**
 * Quality gates для постов AVATERRA (порт из DenisBot1).
 */
import { normalizeBrandFromKb } from './brand-kb';

type BrandNorm = ReturnType<typeof normalizeBrandFromKb>;

export type QualityIssue = { code: string; message: string; suggestion?: string };

export type QualityReport = {
  passed: boolean;
  issues: QualityIssue[];
  feedbackForRetry(): string;
};

const DEFAULT_LENGTH_WINDOWS: Record<string, [number, number]> = {
  educational: [1200, 1800],
  pain: [1000, 1500],
  practice: [700, 1100],
  author: [900, 1400],
  faq: [800, 1300],
  course: [1500, 2400],
  reflection: [600, 1100],
  info: [1500, 2400],
  sales: [1500, 2400],
};

const DEFAULT_WHITELIST = new Set(['CTA', 'Telegram', 'VIP', 'URL', 'DM']);

const CTA_HINT_PATTERNS = [
  /https?:\/\//i,
  /avaterra\.pro/i,
  /\bкурс[аеуы]?\b/i,
  /\b(?:сохраните|поделитесь|напишите|задайте)\b/i,
  /\bподробнее\b/i,
  /\b(?:программ[ау]|каталог)\b/i,
  /support@avaterra\.pro/i,
];

const FAQ_ACRONYM = /\bFAQ\b/;
const CALIBRATION = /калибр/i;
const METHOD_WORD = /\bметод(?:а|у|ом|е|ы|ов|ам|ами|ах)?\b/i;
const LATIN_BRAND = /\b[Aa][Vv][Aa][Tt][Ee][Rr][Rr][Aa]\b/;
const URL_PATTERN = /https?:\/\/[^\s)\]}>,;]+/gi;
const URL_OR_EMAIL = /(https?:\/\/\S+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/gi;

function lengthWindow(brand: BrandNorm, postType: string): [number, number] {
  for (const tpl of brand.templates) {
    if (tpl.id === postType) {
      const length = tpl.length as { min?: number; max?: number } | undefined;
      if (typeof length?.min === 'number' && typeof length?.max === 'number' && length.max > length.min) {
        return [length.min, length.max];
      }
    }
  }
  return DEFAULT_LENGTH_WINDOWS[postType] ?? [1200, 2000];
}

function checkProhibited(text: string, brand: BrandNorm): QualityIssue | null {
  for (const phrase of brand.prohibitedPhrases) {
    try {
      if (new RegExp(phrase, 'i').test(text)) {
        return {
          code: 'prohibited_phrase',
          message: `запрещённая формулировка: «${phrase}»`,
          suggestion: 'переформулируй мягче, без обещаний лечения',
        };
      }
    } catch {
      if (text.toLowerCase().includes(phrase.toLowerCase())) {
        return { code: 'prohibited_phrase', message: `запрещённая формулировка: «${phrase}»` };
      }
    }
  }
  return null;
}

function checkLatinWords(text: string, brand: BrandNorm): QualityIssue | null {
  const whitelistArr = [...DEFAULT_WHITELIST, ...(brand.textWhitelist ?? [])];
  const whitelist = new Set(whitelistArr);
  const found: string[] = [];
  for (const token of text.match(/[A-Za-z][A-Za-z\-]{1,}/g) ?? []) {
    if (whitelist.has(token) || whitelistArr.some((w) => w.toLowerCase() === token.toLowerCase())) continue;
    found.push(token);
  }
  if (!found.length) return null;
  return {
    code: 'latin_word',
    message: `латинские слова: ${Array.from(new Set(found)).slice(0, 5).join(', ')}`,
    suggestion: 'перепиши на русском',
  };
}

function checkLength(text: string, brand: BrandNorm, postType: string): QualityIssue | null {
  const [minLen, maxLen] = lengthWindow(brand, postType);
  const length = text.trim().length;
  if (length < minLen) {
    return { code: 'too_short', message: `${length} знаков, минимум ${minLen}`, suggestion: 'добавь пример' };
  }
  if (length > maxLen) {
    return { code: 'too_long', message: `${length} знаков, максимум ${maxLen}`, suggestion: 'сократи' };
  }
  return null;
}

function checkCta(text: string): QualityIssue | null {
  if (CTA_HINT_PATTERNS.some((p) => p.test(text))) return null;
  return { code: 'missing_cta', message: 'нет CTA', suggestion: 'добавь ссылку или вопрос' };
}

function checkNoFaqAcronym(text: string): QualityIssue | null {
  if (!FAQ_ACRONYM.test(text)) return null;
  return { code: 'faq_acronym', message: 'акроним FAQ', suggestion: 'замени на «раздел Описание»' };
}

function checkNoCalibration(text: string): QualityIssue | null {
  if (!CALIBRATION.test(text)) return null;
  return { code: 'calibration_word', message: 'слово «калибр…»', suggestion: 'замер через баланс тела' };
}

function checkNoMethodWord(text: string): QualityIssue | null {
  if (!METHOD_WORD.test(text)) return null;
  return { code: 'method_word', message: 'запрещено «метод»', suggestion: 'школа Аватэрра / подход школы' };
}

function checkLatinBrand(text: string): QualityIssue | null {
  const stripped = text.replace(URL_PATTERN, ' ').replace(/\bavaterra\.pro\b\S*/gi, ' ');
  if (!LATIN_BRAND.test(stripped)) return null;
  return { code: 'latin_brand', message: 'Avaterra латиницей', suggestion: 'замени на «Аватэрра»' };
}

function disclaimerNeeded(topic: string, brand: BrandNorm): boolean {
  const triggers = (brand.disclaimer.triggers as string[] | undefined) ?? [];
  const hay = topic.toLowerCase();
  return triggers.some((t) => hay.includes(t.toLowerCase()));
}

function checkDisclaimer(text: string, topic: string, brand: BrandNorm): QualityIssue | null {
  if (!disclaimerNeeded(topic, brand)) return null;
  const hay = text.toLowerCase();
  if (['врач', 'психотерапев', 'не замен', 'острых сим', 'обратитесь'].some((m) => hay.includes(m))) return null;
  return { code: 'missing_disclaimer', message: 'нет дисклеймера', suggestion: 'не замена врачу' };
}

function stripScheme(value: string): string {
  let cleaned = value.trim().replace(/[.,;:!?)]+$/, '').toLowerCase();
  for (const p of ['https://', 'http://']) {
    if (cleaned.startsWith(p)) cleaned = cleaned.slice(p.length);
  }
  return cleaned.replace(/\/$/, '');
}

function allowedUrls(brand: BrandNorm): Set<string> {
  const allowed = new Set<string>();
  const add = (v?: string | null) => {
    if (!v) return;
    const c = stripScheme(v);
    if (c) allowed.add(c);
  };
  for (const product of Object.values(brand.products)) {
    if (product && typeof product === 'object') add((product as { url?: string }).url);
  }
  for (const variants of Object.values(brand.ctaLibrary)) {
    for (const variant of variants ?? []) {
      for (const url of variant.match(/https?:\/\/\S+/g) ?? []) add(url);
    }
  }
  for (const url of Object.values(brand.quickLinks)) add(url);
  return allowed;
}

function checkUrls(text: string, brand: BrandNorm): QualityIssue | null {
  const allowed = allowedUrls(brand);
  if (!allowed.size) return null;
  const hosts = new Set(Array.from(allowed).map((e) => e.split('/')[0]));
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const host of hosts) {
    const pattern = new RegExp(`(?<![A-Za-z0-9.@\\-])${host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^\\s)\\]}>,;]*)?`, 'gi');
    for (const match of text.matchAll(pattern)) {
      const cleaned = stripScheme(match[0]);
      if (allowed.has(cleaned) || seen.has(cleaned)) continue;
      seen.add(cleaned);
      bad.push(match[0]);
    }
  }
  if (!bad.length) return null;
  return { code: 'url_not_whitelisted', message: `ссылки вне whitelist: ${bad.slice(0, 3).join(', ')}` };
}

const LEXICON_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAVATERRA\b/g, 'Аватэрра'],
  [/\bAvaterra\b/g, 'Аватэрра'],
  [/калибровкой/gi, 'замером через баланс тела'],
  [/калибровке/gi, 'замере через баланс тела'],
  [/калибровку/gi, 'замер через баланс тела'],
  [/калибровки/gi, 'замера через баланс тела'],
  [/калибровка/gi, 'замер через баланс тела'],
  [/калибровать/gi, 'сверить ответ с балансом'],
];

export function normalizePostLexicon(text: string): string {
  if (!text) return text;
  const parts = text.split(URL_OR_EMAIL);
  const tokens = text.match(URL_OR_EMAIL) ?? [];
  let out = '';
  let ti = 0;
  for (let i = 0; i < parts.length; i++) {
    let chunk = parts[i] ?? '';
    for (const [re, rep] of LEXICON_REPLACEMENTS) chunk = chunk.replace(re, rep);
    out += chunk;
    if (ti < tokens.length) {
      out += tokens[ti];
      ti += 1;
    }
  }
  return out;
}

export function scanPublishBlockers(text: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const fn of [checkNoFaqAcronym, checkNoCalibration, checkNoMethodWord, checkLatinBrand]) {
    const r = fn(text);
    if (r) issues.push(r);
  }
  return issues;
}

export function evaluateText(params: {
  text: string;
  topic: string;
  postType: string;
  brand: BrandNorm;
}): QualityReport {
  const issues: QualityIssue[] = [];
  for (const fn of [
    () => checkProhibited(params.text, params.brand),
    () => checkLatinWords(params.text, params.brand),
    () => checkLength(params.text, params.brand, params.postType),
    () => checkCta(params.text),
    () => checkDisclaimer(params.text, params.topic, params.brand),
    () => checkUrls(params.text, params.brand),
    () => checkNoFaqAcronym(params.text),
    () => checkNoCalibration(params.text),
    () => checkNoMethodWord(params.text),
    () => checkLatinBrand(params.text),
  ]) {
    const r = fn();
    if (r) issues.push(r);
  }
  return {
    passed: !issues.length,
    issues,
    feedbackForRetry() {
      if (!issues.length) return '';
      return (
        'Что нужно поправить:\n' +
        issues.map((i) => `- [${i.code}] ${i.message}${i.suggestion ? ` ${i.suggestion}` : ''}`).join('\n')
      );
    },
  };
}
