/**
 * In-memory log of recent LLM requests for the "Лог запросов к AI" block in admin ai-settings.
 * Entries are kept up to MAX_ENTRIES; oldest are dropped. Log is lost on process restart.
 */
export interface LlmRequestLogEntry {
  at: string; // ISO
  source: string; // 'chatbot' | 'suggest-reply' | 'ticket-auto-reply' | 'generate-text' | 'ai-assist' | 'prompt-generate' | 'verification-ai-summary'
  model: string;
  promptChars: number;
  responseChars: number;
  /** Грубая оценка токенов (символы / 4) для ориентира по «объёму» вызова. */
  promptTokensEst: number;
  responseTokensEst: number;
  durationMs: number;
  userId?: string;
  role?: string;
}

const MAX_ENTRIES = 100;
const entries: LlmRequestLogEntry[] = [];

export function logLlmRequest(entry: Omit<LlmRequestLogEntry, 'at' | 'promptTokensEst' | 'responseTokensEst'>): void {
  const promptTokensEst = Math.max(1, Math.ceil(entry.promptChars / 4));
  const responseTokensEst = Math.max(0, Math.ceil(entry.responseChars / 4));
  entries.unshift({
    ...entry,
    promptTokensEst,
    responseTokensEst,
    at: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) entries.pop();
}

export function getLlmRequestLog(limit: number = 50): LlmRequestLogEntry[] {
  return entries.slice(0, limit);
}

export function getLlmRequestLogAggregate(): {
  totalCalls: number;
  promptTokensEst: number;
  responseTokensEst: number;
  promptChars: number;
  responseChars: number;
} {
  let promptTokensEst = 0;
  let responseTokensEst = 0;
  let promptChars = 0;
  let responseChars = 0;
  for (const e of entries) {
    promptTokensEst += e.promptTokensEst;
    responseTokensEst += e.responseTokensEst;
    promptChars += e.promptChars;
    responseChars += e.responseChars;
  }
  return {
    totalCalls: entries.length,
    promptTokensEst,
    responseTokensEst,
    promptChars,
    responseChars,
  };
}
