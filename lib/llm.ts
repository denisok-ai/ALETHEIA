/**
 * LLM: get API key from DB (decrypt) — from saved LlmApiKey or inline apiKeyEncrypted. Used by chat and ai-assist.
 * Fallback: Настройки → Переменные окружения (DeepSeek API ключ). Настройки вынесены в админку.
 */
import { prisma } from './db';
import { decrypt } from './encrypt';
import { getEnvOverrides } from './settings';

export async function getLlmApiKey(llmKey: string): Promise<string | null> {
  const row = await prisma.llmSetting.findUnique({
    where: { key: llmKey },
    select: { apiKeyEncrypted: true, apiKeyId: true, apiKey: { select: { apiKeyEncrypted: true } } },
  });

  /**
   * Запасной ключ из настроек/env. Опасен молчаливостью: если выбранный в админке
   * ключ не расшифровался, сюда попадает СТАРЫЙ ключ, и провайдер отвечает 401 —
   * выглядит как «сломался чат», хотя причина в ключе (реальный инцидент 19.07.2026,
   * потерян час на диагностику). Поэтому логируем факт отката явно.
   */
  const envFallback = async (reason: string): Promise<string | null> => {
    const overrides = await getEnvOverrides();
    const ds = overrides.deepseek_api_key?.trim();
    const oai = overrides.openai_api_key?.trim();
    const key = ds || oai || null;
    if (key) {
      console.warn(
        `[getLlmApiKey] «${llmKey}»: используется ЗАПАСНОЙ ключ из настроек/env (${reason}). ` +
          'Если провайдер отвечает 401 — привяжите действующий ключ в Портал → Настройки AI.'
      );
    } else {
      console.warn(`[getLlmApiKey] «${llmKey}»: ключ не найден (${reason}) и запасного нет.`);
    }
    return key;
  };

  if (!row) return envFallback('настройка LLM не заведена');

  if (row.apiKeyId && row.apiKey?.apiKeyEncrypted) {
    try {
      const plain = decrypt(row.apiKey.apiKeyEncrypted).trim();
      if (plain) return plain;
    } catch (e) {
      console.warn(
        `[getLlmApiKey] Не удалось расшифровать ключ из LlmApiKey для «${llmKey}» (несовпадение NEXTAUTH_SECRET или битые данные) — пробуем inline/env.`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (row.apiKeyEncrypted) {
    try {
      const plain = decrypt(row.apiKeyEncrypted).trim();
      if (plain) return plain;
    } catch (e) {
      console.warn(
        `[getLlmApiKey] Не удалось расшифровать apiKeyEncrypted для «${llmKey}» — пробуем env (DeepSeek/OpenAI из настроек).`,
        e instanceof Error ? e.message : e
      );
    }
  }

  return envFallback('ключ из админки отсутствует или не расшифровался');
}
