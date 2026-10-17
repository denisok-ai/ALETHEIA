/**
 * Полная проверка поста перед записью в очередь (scripts/social-enqueue.ts, scripts/social-crosspost.ts).
 *
 * Правила не дублируем, все берём из существующих модулей:
 *  - подпись по сети — buildTelegramCaption / buildPlainCaption (внутри buildCaption):
 *    запрещённые формулировки, «не» в заголовке, лимит подписи;
 *  - стоп-слова публикации — scanPublishBlockers (FAQ, «калибр…», «метод», латинская Avaterra, чужой домен);
 *  - из evaluateText (quality-gates) берём только то, что относится к постам:
 *    дисклеймер по триггерам, окно длины по типу поста, CTA по default_cta типа, латиница;
 *  - не берём из evaluateText: checkProhibited (уже в buildCaption), checkUrls, checkNoFaqAcronym,
 *    checkNoCalibration, checkNoMethodWord, checkLatinBrand (их даёт scanPublishBlockers; для постов
 *    эти проверки одинаковы, все продуктовые ссылки в avaterra.yaml ведут на avaterra.pro).
 *
 * Важно: buildCaption нормализует лексику («калибровка» → «замер через баланс тела», «AVATERRA» →
 * «Аватэрра»), поэтому стоп-слова ищем в исходном тексте title+body, а не в подписи.
 */
import type { normalizeBrandFromKb } from '@/lib/content/brand-kb';
import { evaluateText, scanPublishBlockers } from '@/lib/content/quality-gates';
import { buildPlainCaption, READY_POST_NETWORKS, type ReadyPostNetwork } from './captions';
import { buildTelegramCaption, SCHOOL_COURSE_URL } from './telegram-caption';

type BrandNorm = ReturnType<typeof normalizeBrandFromKb>;

export type QueuedPostInput = {
  /** telegram, max, а также готовые сети: vk, dzen, rutube, youtube. */
  networkCode: string;
  title: string;
  body?: string;
  /** Есть ли ролик или картинка: от этого зависит лимит подписи. */
  hasMedia: boolean;
  /** Метка ?ref=, например tg-01 или vk-01. */
  refCode: string;
  /** Ссылка поста без метки; по умолчанию страница практикума. */
  url?: string;
  /** Строка хештегов; по умолчанию — хештеги сети. */
  hashtags?: string;
  /** Тип поста из post_types avaterra.yaml (необязательно). Без него окна длины и CTA не проверяются. */
  postType?: string;
  /** Нормализованная база знаний: normalizeBrandFromKb(loadKbYamlFromPath(...)). */
  brand: BrandNorm;
};

export type QueuedPostChecks = {
  /** Причины не писать пост в очередь. */
  problems: string[];
  /** Замечания: пост можно записать, но их стоит посмотреть. */
  warnings: string[];
};

const READY_NETWORKS = new Set<string>(READY_POST_NETWORKS);

const DISCLAIMER_HINT =
  'в тексте есть тема из disclaimer.triggers, а дисклеймера нет: добавьте фразу «не замена врачу» (текст в avaterra.yaml)';

/** Предупреждения подписи той сети, куда пойдёт пост. Все они блокируют запись (как и раньше). */
function captionWarnings(input: QueuedPostInput): string[] {
  const common = {
    title: input.title,
    body: input.body,
    url: input.url ?? SCHOOL_COURSE_URL,
    refCode: input.refCode,
    hashtags: input.hashtags,
    prohibitedPhrases: input.brand.prohibitedPhrases,
    hasMedia: input.hasMedia,
  };
  if (input.networkCode === 'telegram' || input.networkCode === 'max') {
    return buildTelegramCaption({ ...common, networkCode: input.networkCode }).warnings;
  }
  if (READY_NETWORKS.has(input.networkCode)) {
    return buildPlainCaption({ ...common, networkCode: input.networkCode as ReadyPostNetwork }).warnings;
  }
  throw new Error(`checkQueuedPost: неизвестная сеть «${input.networkCode}»`);
}

function unique(items: readonly string[]): string[] {
  return Array.from(new Set(items));
}

/**
 * Проверка поста очереди. Чистая функция: без БД, сети и чтения файлов.
 * Список problems пуст и warnings пуст — пост можно ставить в очередь.
 */
export function checkQueuedPost(input: QueuedPostInput): QueuedPostChecks {
  const problems: string[] = [...captionWarnings(input)];
  const warnings: string[] = [];

  const title = (input.title ?? '').trim();
  const body = (input.body ?? '').trim();
  const text = [title, body].filter(Boolean).join('\n\n');

  // Стоп-слова публикации: по исходному тексту (подпись уже нормализована).
  for (const issue of scanPublishBlockers(text)) problems.push(issue.message);

  const postType = input.postType?.trim() || undefined;
  const template = postType ? input.brand.templates.find((t) => t.id === postType) : undefined;
  const typeHasCta = typeof template?.default_cta === 'string' && template.default_cta.trim() !== '';

  // evaluateText с пустым postType использует окно по умолчанию — его длину и CTA не берём.
  const report = evaluateText({ text, topic: text, postType: postType ?? '', brand: input.brand });
  // Латиница: ссылки и почту из текста убираем, иначе слова адреса (https, avaterra, pro) дают шум.
  // Поэтому латиницу берём из отдельного прогона по тексту без ссылок.
  const withoutLinks = text.replace(/https?:\/\/\S+/gi, ' ').replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, ' ');
  const latinReport = evaluateText({ text: withoutLinks, topic: withoutLinks, postType: '', brand: input.brand });
  for (const issue of latinReport.issues.filter((i) => i.code === 'latin_word')) {
    warnings.push(`${issue.message}: если это не название, перепишите на русском`);
  }
  for (const issue of report.issues) {
    switch (issue.code) {
      case 'missing_disclaimer':
        problems.push(DISCLAIMER_HINT);
        break;
      case 'too_short':
      case 'too_long':
        if (postType) warnings.push(`тип «${postType}»: ${issue.message} (окно длины из avaterra.yaml)`);
        break;
      case 'missing_cta':
        if (postType && typeHasCta) {
          warnings.push(`тип «${postType}» ждёт CTA (default_cta: ${template?.default_cta}), а в тексте нет ссылки или призыва`);
        }
        break;
      default:
        // prohibited_phrase — в buildCaption; url, faq, калибровка, метод, латиница бренда — выше, через scanPublishBlockers.
        break;
    }
  }

  return { problems: unique(problems), warnings: unique(warnings) };
}
