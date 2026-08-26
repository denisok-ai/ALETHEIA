/**
 * AI-ответ бота на свободный вопрос — второй уровень после точного FAQ.
 *
 * Порядок в боте: matchFaqAnswer (выверенный текст) → этот AI по базе знаний
 * (с медицинским дисклеймером и сверкой с витриной) → человек. AI отвечает
 * только по базе знаний школы, тот же проверенный движок, что и веб-чат
 * (lib/ai/public-chat).
 *
 * Бюджетная дисциплина: не гоняем LLM на «спасибо»/«ок», лимитируем частоту
 * на чат (LLM платный), помним пару последних реплик для связности.
 */
import { answerPublicQuestion } from '@/lib/ai/public-chat';

/** Слова-заполнители: сообщение из одних таких — не вопрос, LLM не нужен. */
const TRIVIAL_WORDS = new Set([
  'ок', 'окей', 'спасибо', 'спасибки', 'спс', 'ага', 'угу', 'да', 'нет', 'привет',
  'здравствуйте', 'понятно', 'хорошо', 'класс', 'супер', 'thanks', 'thank', 'ok', 'okay',
]);

/** true, если в сообщении нет ничего, кроме благодарностей/подтверждений и знаков. */
function isTrivial(text: string): boolean {
  const words = text.toLowerCase().replace(/[^a-zа-яё\s]/gi, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => TRIVIAL_WORDS.has(w));
}

/** История диалога с ботом на чат (в памяти процесса): последние реплики для связности. */
type Turn = { role: 'user' | 'assistant'; content: string };
const dialogs = new Map<number, Turn[]>();
const MAX_TURNS = 6;

/** Антифлуд AI: не чаще одного LLM-вызова в N секунд на чат. */
const AI_COOLDOWN_MS = 8000;
const lastAiAt = new Map<number, number>();

export function rememberUserTurn(chatId: number, text: string): void {
  const turns = dialogs.get(chatId) ?? [];
  turns.push({ role: 'user', content: text.slice(0, 1000) });
  dialogs.set(chatId, turns.slice(-MAX_TURNS));
}

function rememberBotTurn(chatId: number, text: string): void {
  const turns = dialogs.get(chatId) ?? [];
  turns.push({ role: 'assistant', content: text.slice(0, 1000) });
  dialogs.set(chatId, turns.slice(-MAX_TURNS));
}

export function clearDialog(chatId: number): void {
  dialogs.delete(chatId);
  lastAiAt.delete(chatId);
}

/**
 * Ответ LLM приходит в markdown. Telegram с parseMode=HTML отклонит сырой
 * markdown и «голые» &<> — поэтому экранируем, затем разворачиваем безопасное
 * подмножество: **жирный**, *курсив*, [текст](url), `код`. Голые URL Telegram
 * автолинкует сам, так что их не трогаем.
 */
export function markdownToTelegramHtml(md: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Ссылки вырезаем до экранирования, подставляем плейсхолдеры, чтобы url не пострадал.
  const links: { text: string; href: string }[] = [];
  let work = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text, href) => {
    links.push({ text, href });
    return `\u0000L${links.length - 1}\u0000`;
  });
  work = esc(work);
  work = work
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  work = work.replace(/\u0000L(\d+)\u0000/g, (_m, i) => {
    const l = links[Number(i)];
    return l ? `<a href="${l.href}">${esc(l.text)}</a>` : '';
  });
  return work;
}

export type BotAiResult =
  | { kind: 'answer'; text: string }
  | { kind: 'skip'; reason: 'trivial' | 'cooldown' | 'unavailable' };

/**
 * Попробовать ответить вопрос через AI. `skip` — значит пусть решает вызывающий
 * (передать человеку). История берётся из памяти процесса, текущий вопрос в неё
 * уже НЕ входит — передаём его отдельно.
 */
export async function tryBotAiAnswer(chatId: number, question: string): Promise<BotAiResult> {
  const text = question.trim();
  if (text.length < 5 || isTrivial(text)) return { kind: 'skip', reason: 'trivial' };

  const now = Date.now();
  const prev = lastAiAt.get(chatId) ?? 0;
  if (now - prev < AI_COOLDOWN_MS) return { kind: 'skip', reason: 'cooldown' };
  lastAiAt.set(chatId, now);

  const history = (dialogs.get(chatId) ?? []).filter((t) => t.content !== text);
  const result = await answerPublicQuestion({ message: text, history, surface: 'telegram-bot' });
  if (!result.ok) return { kind: 'skip', reason: 'unavailable' };

  rememberUserTurn(chatId, text);
  rememberBotTurn(chatId, result.answer);
  return { kind: 'answer', text: markdownToTelegramHtml(result.answer) };
}
