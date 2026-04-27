/**
 * Вызовы chat completions для разных провайдеров (настройки чат-бота в админке).
 * Раньше все запросы шли на DeepSeek — при ключе OpenAI/Anthropic получали 401/404 и «Сервис недоступен».
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/v1/chat/completions';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

export type LlmChatCompletionResult =
  | { ok: true; content: string }
  | { ok: false; status: number; bodySnippet?: string };

function normProvider(p: string | null | undefined): string {
  return (p || '').trim().toLowerCase();
}

/**
 * Провайдер для чат-бота.
 * Важно: если выбран сохранённый ключ (apiKeyId), **сначала** берём провайдер с этого ключа —
 * иначе OpenAI-ключ уезжает на endpoint DeepSeek и даёт 401 «invalid api key».
 * Поле «Провайдер» в форме может не совпадать с типом ключа после смены только ключа.
 */
export function resolveChatbotProvider(
  row: {
    provider: string;
    apiKey: { provider: string } | null;
  } | null,
  env: { deepseek_api_key?: string; openai_api_key?: string }
): string {
  const fromLinkedKey = normProvider(row?.apiKey?.provider);
  if (fromLinkedKey && fromLinkedKey !== 'other') {
    return fromLinkedKey;
  }

  let p = normProvider(row?.provider);
  if (!p || p === 'other') {
    if (env.deepseek_api_key?.trim()) return 'deepseek';
    if (env.openai_api_key?.trim()) return 'openai';
    return 'deepseek';
  }
  return p;
}

/**
 * Модель из настроек может остаться от другого провайдера (например deepseek-chat при ключе OpenAI).
 */
export function resolveEffectiveChatModel(provider: string, configuredModel: string | null | undefined): string {
  const p = normProvider(provider);
  const m = (configuredModel ?? '').trim().toLowerCase();

  if (p === 'openai') {
    if (!m || m.includes('deepseek') || m.startsWith('claude')) return 'gpt-4o-mini';
    return (configuredModel ?? '').trim() || 'gpt-4o-mini';
  }
  if (p === 'anthropic') {
    if (!m || m.includes('deepseek') || m.includes('gpt-')) return 'claude-3-5-haiku-20240307';
    return (configuredModel ?? '').trim() || 'claude-3-5-haiku-20240307';
  }
  // deepseek и прочие OpenAI-compatible
  if (m.includes('gpt-') || m.startsWith('claude')) return 'deepseek-chat';
  return (configuredModel ?? '').trim() || 'deepseek-chat';
}

function openAiCompatibleUrl(provider: string): string {
  const p = normProvider(provider);
  if (p === 'openai') return OPENAI_CHAT_URL;
  if (p === 'deepseek') return DEEPSEEK_CHAT_URL;
  // «Другой» / неизвестный — часто OpenAI-совместимый шлюз
  return OPENAI_CHAT_URL;
}

async function completeAnthropic(
  apiKey: string,
  model: string,
  messages: ChatTurn[],
  maxTokens: number,
  temperature: number
): Promise<LlmChatCompletionResult> {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const system = systemParts.join('\n\n') || 'You are a helpful assistant.';
  const rest = messages.filter((m) => m.role !== 'system');
  const anthroMessages = rest.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  if (anthroMessages.length === 0) {
    return { ok: false, status: 400, bodySnippet: 'no user messages' };
  }

  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: anthroMessages,
      temperature,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status, bodySnippet: t.slice(0, 500) };
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text =
    data.content?.find((c) => c.type === 'text')?.text?.trim() ||
    data.content?.map((c) => c.text).filter(Boolean).join('\n').trim() ||
    '';
  if (!text) {
    return { ok: false, status: 502, bodySnippet: 'empty anthropic response' };
  }
  return { ok: true, content: text };
}

async function completeOpenAiCompatible(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatTurn[],
  maxTokens: number,
  temperature: number
): Promise<LlmChatCompletionResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status, bodySnippet: t.slice(0, 500) };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    return { ok: false, status: 502, bodySnippet: 'empty choices' };
  }
  return { ok: true, content };
}

/**
 * Один раунд диалога (system + user / цепочка) через выбранный провайдер.
 */
export async function completeLlmChat(params: {
  provider: string;
  apiKey: string;
  model: string;
  messages: ChatTurn[];
  maxTokens: number;
  temperature: number;
}): Promise<LlmChatCompletionResult> {
  const p = normProvider(params.provider);
  const model = resolveEffectiveChatModel(p, params.model);
  if (p === 'anthropic') {
    return completeAnthropic(
      params.apiKey,
      model,
      params.messages,
      params.maxTokens,
      params.temperature
    );
  }
  const url = openAiCompatibleUrl(p);
  return completeOpenAiCompatible(
    url,
    params.apiKey,
    model,
    params.messages,
    params.maxTokens,
    params.temperature
  );
}

/** Короткое сообщение для UI из тела ответа провайдера (JSON). */
export function parseLlmErrorHint(status: number, bodySnippet?: string): string | undefined {
  if (!bodySnippet) return undefined;
  try {
    const j = JSON.parse(bodySnippet) as { error?: { message?: string } };
    const msg = j?.error?.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim().slice(0, 280);
  } catch {
    // не JSON
  }
  return undefined;
}
