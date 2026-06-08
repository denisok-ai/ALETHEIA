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

  const envFallback = async (): Promise<string | null> => {
    const overrides = await getEnvOverrides();
    const ds = overrides.deepseek_api_key?.trim();
    const oai = overrides.openai_api_key?.trim();
    return ds || oai || null;
  };

  if (!row) return envFallback();

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

  return envFallback();
}
