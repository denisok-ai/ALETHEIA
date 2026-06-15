/**
 * Недельный контент-план AVATERRA.
 */
import { prisma } from '@/lib/db';
import { getBrandProfile } from '../brand-kb';
import { getContentConfig } from '../config';
import {
  DuplicateChecker,
  buildMinHash,
  extractKeywords,
  fingerprint,
  type HistoricalFingerprint,
} from '../deduplication';

const WEEKDAY_TO_TYPE: Record<number, string> = {
  0: 'educational',
  1: 'pain',
  2: 'practice',
  3: 'author',
  4: 'faq',
  5: 'course',
  6: 'reflection',
};

const DEFAULT_OBJECTIVE: Record<string, string> = {
  educational: 'укрепить экспертность',
  pain: 'откликнуться болью',
  practice: 'дать микро-инструмент',
  author: 'усилить доверие к автору',
  faq: 'снять возражение',
  course: 'мягко довести до действия',
  reflection: 'закрыть неделю паузой',
};

const FALLBACK_TOPICS: Record<string, string[]> = {
  educational: ['Почему тело часто честнее головы', 'Мышечное тестирование простыми словами'],
  pain: ['Жизнь на автопилоте', 'Отдыхаю, но устаю — что внутри тела'],
  practice: ['Микро-наблюдение тела в обычном дне', 'Вопрос, который возвращает в тело'],
  author: ['Школа Аватэрра — практика, а не теория', 'Опыт основательницы школы'],
  faq: ['Это эзотерика? Спокойный ответ', 'А если не получится?'],
  course: ['Кому подойдёт «Тело не врёт»', '«Тело не врёт» или «Пробуждение»'],
  reflection: ['Тихий вопрос на конец недели', 'Что услышало ваше тело за неделю'],
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(monday: Date): Date {
  const x = new Date(monday);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function scheduleFromBrand(templates: Array<Record<string, unknown>>, postsPerWeek: number): Record<number, string> {
  const weekdayIndex: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  };
  const schedule: Record<number, string> = {};
  for (const tpl of templates) {
    const pt = tpl.id as string | undefined;
    const wd = tpl.weekday as string | undefined;
    if (pt && wd && weekdayIndex[wd] !== undefined) schedule[weekdayIndex[wd]] = pt;
  }
  if (!Object.keys(schedule).length) return { ...WEEKDAY_TO_TYPE };
  if (postsPerWeek === 3) return { 0: 'educational', 2: 'educational', 4: 'course' };
  return schedule;
}

async function pickTheme(postType: string, usedTopics: string[]): Promise<{ topic: string; id: string | null }> {
  const candidates = await prisma.themePool.findMany({
    where: { status: 'pending', postType },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 15,
  });
  const checker = new DuplicateChecker();
  for (const c of candidates) {
    const history: HistoricalFingerprint[] = usedTopics.map((t, idx) => ({
      referenceId: String(idx),
      minhash: buildMinHash(t),
      keywords: extractKeywords(t),
    }));
    if (!checker.check(fingerprint(c.topic), history).isDuplicate) return { topic: c.topic, id: c.id };
  }
  const pool = FALLBACK_TOPICS[postType] ?? [`Тема для ${postType}`];
  return { topic: pool[usedTopics.length % pool.length], id: null };
}

export async function buildWeekPlan(targetMonday?: Date) {
  const config = await getContentConfig();
  const brand = await getBrandProfile();
  const templates = brand?.normalized.templates ?? [];
  const schedule = scheduleFromBrand(templates, config.postsPerWeek);

  const monday = targetMonday ? startOfWeek(targetMonday) : startOfWeek(new Date());
  const sunday = endOfWeek(monday);

  let plan = await prisma.contentPlan.findFirst({ where: { weekStart: monday } });
  if (!plan) {
    plan = await prisma.contentPlan.create({
      data: { weekStart: monday, weekEnd: sunday, status: 'draft' },
    });
  }

  const existing = await prisma.contentItem.findMany({ where: { planId: plan.id } });
  const usedTopics = existing.map((i) => i.topic);
  const created: string[] = [];

  for (const [offsetStr, postType] of Object.entries(schedule)) {
    const offset = parseInt(offsetStr, 10);
    const publishDate = new Date(monday);
    publishDate.setDate(publishDate.getDate() + offset);

    const dup = existing.find(
      (e) => e.publishDate.toDateString() === publishDate.toDateString() && e.postType === postType
    );
    if (dup && dup.status !== 'planned') continue;

    const tpl = templates.find((t) => t.id === postType);
    const objective = (tpl?.objective as string) || DEFAULT_OBJECTIVE[postType] || 'развивать канал';
    const theme = await pickTheme(postType, usedTopics);
    usedTopics.push(theme.topic);

    const ctaLib = brand?.normalized.ctaLibrary ?? {};
    const cta = (ctaLib.soft?.[0] as string | undefined) ?? 'Сохраните пост и поделитесь с близкими.';
    const outline = ((tpl?.structure as string[]) ?? []).join(' → ') || 'Боль → разбор → польза → CTA';

    if (dup) {
      await prisma.contentItem.update({
        where: { id: dup.id },
        data: { topic: theme.topic, objective, outline, cta, themeId: theme.id ?? undefined },
      });
    } else {
      await prisma.contentItem.create({
        data: {
          planId: plan.id,
          publishDate,
          postType,
          topic: theme.topic,
          objective,
          outline,
          cta,
          themeId: theme.id ?? undefined,
          audience: (tpl?.default_audience as string) ?? null,
          rubric: (tpl?.default_rubric as string) ?? null,
          status: 'planned',
        },
      });
    }
    if (theme.id) {
      await prisma.themePool.update({ where: { id: theme.id }, data: { status: 'scheduled' } });
    }
    created.push(`${publishDate.toLocaleDateString('ru-RU')}: ${postType} — ${theme.topic.slice(0, 50)}`);
  }

  await prisma.contentPlan.update({ where: { id: plan.id }, data: { status: 'active' } });
  return { planId: plan.id, items: created };
}

export async function formatPlanSummary(planId?: string): Promise<string> {
  const plan =
    planId != null
      ? await prisma.contentPlan.findUnique({ where: { id: planId } })
      : await prisma.contentPlan.findFirst({ orderBy: { weekStart: 'desc' } });
  if (!plan) return 'Контент-план не найден. Запустите /plan_now.';
  const items = await prisma.contentItem.findMany({
    where: { planId: plan.id },
    orderBy: { publishDate: 'asc' },
  });
  const lines = items.map(
    (it, i) =>
      `${i + 1}. ${it.publishDate.toLocaleDateString('ru-RU')} · <b>${it.postType}</b> · ${it.status}\n   ${it.topic.slice(0, 80)}`
  );
  return `<b>План ${plan.weekStart.toLocaleDateString('ru-RU')} — ${plan.weekEnd.toLocaleDateString('ru-RU')}</b>\n\n${lines.join('\n\n')}`;
}
