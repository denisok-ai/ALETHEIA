/**
 * JS-цели Яндекс.Метрики, которые шлёт сайт (lib/analytics-events.ts → ym reachGoal).
 *
 * Зачем: до 16.10.2026 в счётчике были только автоцели, а reachGoal с нашими
 * идентификаторами Метрика молча отбрасывала — клики «Записаться», прокрутка
 * до цен и оплаты нигде не считались. Скрипт создаёт недостающие цели и ничего
 * не удаляет (идемпотентно: цель с тем же идентификатором не дублируется).
 *
 * Запуск на сервере: npx tsx --env-file=.env scripts/metrika-ensure-goals.ts [--dry]
 */
import { ANALYTICS } from '../lib/analytics-events';
import { METRIKA_COUNTER_ID } from '../lib/seo/metrika';
import { getSeoSecret } from '../lib/seo/secrets';

const NAMES: Record<string, string> = {
  [ANALYTICS.CLICK_ENROLL]: 'Сайт: клик «Записаться/Купить»',
  [ANALYTICS.FORM_SUBMIT]: 'Сайт: отправка формы заявки',
  [ANALYTICS.PAGE_VIEW_COURSE]: 'Сайт: просмотр страницы курса',
  [ANALYTICS.SCROLL_PRICING]: 'Сайт: прокрутка до цен',
  [ANALYTICS.ENGAGEMENT_2MIN]: 'Сайт: 2 минуты на главной',
  [ANALYTICS.PAYMENT_SUCCESS]: 'Сайт: оплата прошла (с суммой)',
};

const API = `https://api-metrika.yandex.net/management/v1/counter/${METRIKA_COUNTER_ID}/goals`;

type Goal = { id: number; name: string; type: string; conditions?: Array<{ type: string; url: string }> };

async function main(): Promise<number> {
  const dry = process.argv.includes('--dry');
  const token = getSeoSecret('YANDEX_OAUTH_TOKEN');
  if (!token) {
    console.error('Нет YANDEX_OAUTH_TOKEN (secrets/seo.env).');
    return 1;
  }
  const headers = { Authorization: `OAuth ${token}`, 'Content-Type': 'application/json' };
  const res = await fetch(API, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    console.error(`Список целей: HTTP ${res.status}`);
    return 1;
  }
  const goals = ((await res.json()) as { goals?: Goal[] }).goals ?? [];
  const existing = new Set(
    goals.filter((g) => g.type === 'action').flatMap((g) => (g.conditions ?? []).map((c) => c.url)),
  );

  let created = 0;
  for (const [identifier, name] of Object.entries(NAMES)) {
    if (existing.has(identifier)) {
      console.log(`= ${identifier} — уже есть`);
      continue;
    }
    if (dry) {
      console.log(`+ ${identifier} — будет создана («${name}»)`);
      continue;
    }
    const r = await fetch(API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ goal: { name, type: 'action', conditions: [{ type: 'exact', url: identifier }] } }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await r.json().catch(() => ({}))) as { goal?: Goal; message?: string };
    if (!r.ok || !body.goal) {
      console.error(`! ${identifier}: HTTP ${r.status} ${body.message ?? ''}`);
      return 1;
    }
    created += 1;
    console.log(`+ ${identifier} — создана, id ${body.goal.id}`);
  }
  console.log(dry ? '--dry: ничего не создано.' : `Создано целей: ${created}.`);
  return 0;
}

main().then((code) => {
  process.exitCode = code;
});
