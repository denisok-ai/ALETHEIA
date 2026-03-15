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
    return overrides.deepseek_api_key ?? null;
  };

  if (!row) return envFallback();

  if (row.apiKeyId && row.apiKey?.apiKeyEncrypted) {
    try {
      return decrypt(row.apiKey.apiKeyEncrypted);
    } catch {
      return null;
    }
  }
  if (row.apiKeyEncrypted) {
    try {
      return decrypt(row.apiKeyEncrypted);
    } catch {
      return null;
    }
  }
  return envFallback();
}
