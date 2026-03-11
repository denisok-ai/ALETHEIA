/**
 * LLM: get API key from DB (decrypt) — from saved LlmApiKey or inline apiKeyEncrypted. Used by chat and ai-assist.
 */
import { prisma } from './db';
import { decrypt } from './encrypt';

export async function getLlmApiKey(llmKey: string): Promise<string | null> {
  const row = await prisma.llmSetting.findUnique({
    where: { key: llmKey },
    select: { apiKeyEncrypted: true, apiKeyId: true, apiKey: { select: { apiKeyEncrypted: true } } },
  });
  if (!row) return process.env.DEEPSEEK_API_KEY ?? null;

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
  return process.env.DEEPSEEK_API_KEY ?? null;
}
