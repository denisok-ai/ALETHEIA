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
  { type: 'trust', re: /(не верю|боюсь что не|а вдруг не поможет|гаранти|страшно|развод|обман|точно поможет)/i },
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
