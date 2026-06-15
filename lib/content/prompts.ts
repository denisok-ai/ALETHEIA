/**
 * Промпты DeepSeek для генерации постов AVATERRA.
 */
import { normalizeBrandFromKb } from './brand-kb';

type BrandNorm = ReturnType<typeof normalizeBrandFromKb>;

export type GenerationRequest = {
  postType: string;
  topic: string;
  objective: string;
  outline: string;
  cta: string;
  audienceId?: string | null;
  rubricId?: string | null;
  feedback?: string | null;
};

const COMMON_RULES_RU = `Общие правила:
- Пиши на русском, простыми словами.
- Школу называй «Аватэрра». Латиница только в URL avaterra.pro.
- Без «калибровка/калибр…» — «замер через баланс тела», «сверить с балансом».
- Слово «метод» во всех падежах запрещено; «методика» можно.
- FAQ в тексте запрещён — «раздел Описание».
- Без эмодзи, хэштегов, медицинских обещаний.
- Обращение на «вы».`;

const DEFAULT_LENGTH: Record<string, [number, number]> = {
  educational: [1200, 1800],
  pain: [1000, 1500],
  practice: [700, 1100],
  author: [900, 1400],
  faq: [800, 1300],
  course: [1500, 2400],
  reflection: [600, 1100],
};

function lengthWindow(brand: BrandNorm, postType: string): [number, number] {
  for (const tpl of brand.templates) {
    if (tpl.id === postType) {
      const l = tpl.length as { min?: number; max?: number } | undefined;
      if (typeof l?.min === 'number' && typeof l?.max === 'number') return [l.min, l.max];
    }
  }
  return DEFAULT_LENGTH[postType] ?? [1200, 2000];
}

function structureSteps(brand: BrandNorm, postType: string): string[] {
  for (const tpl of brand.templates) {
    if (tpl.id === postType) {
      const steps = tpl.structure as string[] | undefined;
      if (steps?.length) return steps;
    }
  }
  return ['Зацепка', 'Основная мысль', 'Связь с подходом школы Аватэрра', 'Мягкий CTA'];
}

function audienceBlock(brand: BrandNorm, audienceId?: string | null): string {
  if (!audienceId) return '';
  for (const aud of brand.audiences) {
    if (aud.id === audienceId) {
      const pains = ((aud.pains as string[]) ?? []).join('; ');
      return `Аудитория: ${aud.name}. Боли: ${pains}. Ракурс: ${aud.angle ?? ''}.`;
    }
  }
  return '';
}

function allowedLinksBlock(brand: BrandNorm): string {
  const urls = new Set<string>();
  for (const p of Object.values(brand.products)) {
    const u = (p as { url?: string }).url;
    if (u?.startsWith('http')) urls.add(u.replace(/\/$/, ''));
  }
  for (const u of Object.values(brand.quickLinks)) {
    if (u?.startsWith('http')) urls.add(u.replace(/\/$/, ''));
  }
  if (!urls.size) return '';
  return 'Только эти URL:\n' + Array.from(urls).map((u) => `- ${u}`).join('\n');
}

export function buildTextPrompts(brand: BrandNorm, request: GenerationRequest): [string, string] {
  const [minL, maxL] = lengthWindow(brand, request.postType);
  const structure = structureSteps(brand, request.postType)
    .map((s, i) => `${i + 1}) ${s}`)
    .join('\n');
  const aud = audienceBlock(brand, request.audienceId);
  const links = allowedLinksBlock(brand);

  const system = [
    'Ты — редактор Telegram-канала школы «Аватэрра» (avaterra.pro).',
    `Tone of Voice: ${brand.toneOfVoice}`,
    COMMON_RULES_RU,
    `Длина: ${minL}-${maxL} знаков.`,
    `Структура:\n${structure}`,
    aud,
    links,
    brand.prohibitedPhrases.length
      ? `Запрещено: ${brand.prohibitedPhrases.slice(0, 8).join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const user = [
    `Тип: ${request.postType}`,
    `Тема: ${request.topic}`,
    `Цель: ${request.objective}`,
    `План: ${request.outline}`,
    `CTA: ${request.cta}`,
    request.feedback ? `Исправь:\n${request.feedback}` : '',
    'Верни только готовый текст поста без служебных заголовков.',
  ]
    .filter(Boolean)
    .join('\n');

  return [system, user];
}

export function buildImagePrompt(request: GenerationRequest): string {
  return `Editorial photo mood for AVATERRA school post about: ${request.topic}. No text, no faces, hands and body awareness only.`;
}

export { normalizeBrandFromKb };
