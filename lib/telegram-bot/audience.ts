/**
 * Определение аудитории лида из его свободных сообщений.
 *
 * Сегменты — из базы знаний школы (content/knowledge/avaterra.yaml). По
 * аудитории персонализируются оффер (какой тариф ближе) и тон ответа.
 * Детерминированно, по ключевым словам — без LLM-догадок; не уверены — null.
 */
import { prisma } from '@/lib/db';

export type Audience = 'tense_body' | 'personal_crisis' | 'specialist' | 'spiritual' | 'skeptic';

const PATTERNS: Array<{ audience: Audience; re: RegExp }> = [
  {
    audience: 'specialist',
    re: /(психолог|коуч|массаж|терапевт|специалист|нутрициолог|остеопат|в работу с клиент|для клиентов|для практики|веду практику|расширить практику|инструмент для работы)/i,
  },
  {
    audience: 'tense_body',
    re: /(усталость|устал|нет сил|выгорел|напряжени|зажим|боль в|болит|спина|шея|голова|мигрен|бессонниц|тревог|панич|психосоматик)/i,
  },
  {
    audience: 'personal_crisis',
    re: /(отношени|развод|расстал|одиноч|деньги|финанс|страх будущ|не знаю чего хочу|потеря|утрат|кризис|застрял|самореализац|смысл жизни|тупик)/i,
  },
  {
    audience: 'spiritual',
    re: /(осознанност|духовн|медитац|энерги|чакр|предназначен|подсознани|прошлые жизни|регресс|высшее я)/i,
  },
  {
    audience: 'skeptic',
    re: /(не верю|шарлатан|развод(?!ит)|обман|псевдонаук|докажите|научн(о|ые доказательства)|это работает вообще)/i,
  },
];

/** Определить аудиторию по тексту. null — сигналов недостаточно. */
export function detectAudience(text: string): Audience | null {
  for (const p of PATTERNS) {
    if (p.re.test(text)) return p.audience;
  }
  return null;
}

export const AUDIENCE_LABEL: Record<Audience, string> = {
  tense_body: 'телесное напряжение / усталость',
  personal_crisis: 'личная ситуация',
  specialist: 'помогающий специалист',
  spiritual: 'осознанность / духовный запрос',
  skeptic: 'скептик',
};

/**
 * Сохранить аудиторию лида (только если ещё не определена — первое впечатление
 * устойчивее: человек мог начать с боли, а потом задать общий вопрос).
 */
export async function saveAudienceIfEmpty(chatId: number, audience: Audience): Promise<void> {
  try {
    await prisma.lead.updateMany({
      where: { telegramChatId: chatId, audience: null },
      data: { audience },
    });
  } catch (e) {
    console.error('[audience] save:', e);
  }
}
