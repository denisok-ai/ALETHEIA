/**
 * In-memory log of recent LLM requests for the "Лог запросов к AI" block in admin ai-settings.
 * Entries are kept up to MAX_ENTRIES; oldest are dropped. Log is lost on process restart.
 */
export interface LlmRequestLogEntry {
  at: string; // ISO
  source: string; // 'chatbot' | 'suggest-reply' | 'ticket-auto-reply' | 'generate-text' | 'ai-assist' | 'prompt-generate'
  model: string;
  promptChars: number;
  responseChars: number;
  durationMs: number;
  userId?: string;
  role?: string;
}

const MAX_ENTRIES = 100;
const entries: LlmRequestLogEntry[] = [];

export function logLlmRequest(entry: Omit<LlmRequestLogEntry, 'at'>): void {
  entries.unshift({
    ...entry,
    at: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) entries.pop();
}

export function getLlmRequestLog(limit: number = 50): LlmRequestLogEntry[] {
  return entries.slice(0, limit);
}
