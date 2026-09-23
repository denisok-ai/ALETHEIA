/**
 * Детект и учёт возражений лида — понимание, ПОЧЕМУ не покупают.
 *
 * Не отдельный опрос (лишний спам), а разбор того, что человек и так пишет в
 * ответ на оффер/дожим: «дорого», «нет времени», «надо подумать». Копим в
 * журнал аудита (как faq-miss) и показываем в дайджесте — видно топ-барьеры,
 * их закрывают правкой оффера/FAQ, а не догадками.
 *
 * Детерминированно, по ключевым словам. Никакой LLM-оценки настроения.
 */
import { prisma } from '@/lib/db';

export type Objection = 'price' | 'time' | 'doubt' | 'trust' | 'fit' | 'later';

const PATTERNS: Array<{ type: Objection; re: RegExp }> = [
  { type: 'price', re: /(дорог|дороговато|не потяну|нет денег|нет средств|дороговизна|дешевле|скидк|цена высок|не по карману)/i },
  { type: 'time', re: /(нет времени|некогда|не успеваю|занят|нет сил на это|времени нет)/i },
  { type: 'later', re: /(потом|позже|не сейчас|в другой раз|когда-нибудь|попозже|позднее)/i },
  { type: 'doubt', re: /(сомнева|не уверен|надо подумать|подумаю|не решил|засомнев|ещё думаю|пока думаю)/i },
  { type: 'trust', re: /(не верю|боюсь что не|а вдруг не поможет|гаранти|страшно|обман|точно поможет|это вообще работает)/i },
  { type: 'fit', re: /(не подход|не моё|не для меня|не то что|не уверен что мне)/i },
];

export const OBJECTION_LABEL: Record<Objection, string> = {
  price: 'дорого / цена',
  time: 'нет времени',
  later: 'отложил на потом',
  doubt: 'сомнения / надо подумать',
  trust: 'недоверие / страх',
  fit: 'не подходит',
};

/**
 * Подсказка менеджеру: с чего начать ответ на возражение. Тон школы — без
 * давления, без обещаний результата, «мы не лечим»; сумм не называем (цены
 * меняются на витрине). Это заготовка — менеджер правит под человека.
 */
export const OBJECTION_REPLY: Record<Objection, string> = {
  price:
    'Понимаю, это важное решение. На странице тарифа можно оформить рассрочку. ' +
    'А попробовать метод на себе без вложений можно в бесплатном мини-курсе «Тело знает всё».',
  time:
    'Практика занимает около 15 минут в день, уроки проходятся в своём темпе, доступ открывается сразу. ' +
    'Можно начать с одного урока и посмотреть, как ляжет в ваш ритм.',
  later:
    'Конечно, без спешки. Могу прислать короткую статью о методе, чтобы было с чем познакомиться, ' +
    'и напомнить о старте, если захотите.',
  doubt: 'Подумать — нормально. Какой вопрос сейчас главный? Отвечу точечно, чтобы решение было спокойным.',
  trust:
    'Скепсис — здоровая реакция. Метод проверяется на себе, без веры на слово: начните с бесплатного мини-курса. ' +
    'Мы не лечим и честно говорим о границах метода.',
  fit:
    'Спасибо, что сказали. Расскажите, какой у вас запрос, — подскажу, подходит ли метод ' +
    'или вам ближе другой формат, например «Пробуждение».',
};

/** Найти возражение в тексте. null — не похоже на возражение. */
export function detectObjection(text: string): Objection | null {
  for (const p of PATTERNS) {
    if (p.re.test(text)) return p.type;
  }
  return null;
}

const ACTION = 'lead_objection';

/** Записать возражение в журнал (для сводки). Ошибки глушим — это телеметрия. */
export async function logObjection(chatId: number, objection: Objection, text: string): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: ACTION,
        entity: 'telegram_chat',
        entityId: String(chatId),
        diff: `${objection}: ${text.slice(0, 300)}`,
      },
    });
  } catch (e) {
    console.error('[objection] log:', e);
  }
}

export type ObjectionSummary = { total: number; byType: Array<{ type: Objection; count: number }> };

/** Сводка возражений за последние `hours` часов — топ барьеров для дайджеста. */
export async function fetchObjections(hours = 168): Promise<ObjectionSummary> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: ACTION, createdAt: { gte: since } },
      select: { diff: true },
    });
    const counts = new Map<Objection, number>();
    for (const r of rows) {
      const type = (r.diff?.split(':')[0] ?? '') as Objection;
      if (OBJECTION_LABEL[type]) counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const byType = [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    return { total: rows.length, byType };
  } catch (e) {
    console.error('[objection] fetch:', e);
    return { total: 0, byType: [] };
  }
}

export type LeadObjection = { type: Objection; text: string; at: string };

/** Возражения конкретного лида (по chat id) — для карточки в CRM, новые сверху. */
export async function fetchLeadObjections(chatId: number, limit = 10): Promise<LeadObjection[]> {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: ACTION, entity: 'telegram_chat', entityId: String(chatId) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { diff: true, createdAt: true },
    });
    const out: LeadObjection[] = [];
    for (const r of rows) {
      const raw = r.diff ?? '';
      const i = raw.indexOf(':');
      const type = raw.slice(0, i) as Objection;
      if (i < 0 || !OBJECTION_LABEL[type]) continue;
      out.push({ type, text: raw.slice(i + 1).trim(), at: r.createdAt.toISOString() });
    }
    return out;
  } catch (e) {
    console.error('[objection] lead:', e);
    return [];
  }
}
