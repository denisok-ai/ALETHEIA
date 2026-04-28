/**
 * Персистентный журнал интеграции PayKeeper для админки.
 * Секреты, токены и пароли в payload не пишутся — см. sanitizePayloadForPaykeeperLog.
 */
import { prisma } from '@/lib/db';

/** Ключи, по имени которых значение не пишем в лог (секреты PayKeeper, Basic и т.д.). */
const SENSITIVE_KEY =
  /secret|password|token|authorization|apikey|api_key|credential|bearer|paykeeper_password|paykeeper_secret/i;

const MAX_PAYLOAD_CHARS = 12_000;
const MAX_STRING = 800;
const MAX_MESSAGE = 2000;

export type PaykeeperLogDirection = 'outbound' | 'inbound';

export type PaykeeperLogStatus = 'success' | 'error' | 'warning';

export type PaykeeperIntegrationLogInput = {
  direction: PaykeeperLogDirection;
  event: string;
  status: PaykeeperLogStatus;
  orderNumber?: string | null;
  invoiceUrl?: string | null;
  httpStatus?: number | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
};

/** Маскирует email для логов: ab***@domain.tld */
export function maskEmailForLog(email: string): string {
  const t = email.trim();
  const at = t.indexOf('@');
  if (at <= 0) return '***';
  const local = t.slice(0, at);
  const domain = t.slice(at + 1);
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

/**
 * Удаляет/маскирует чувствительные ключи и обрезает длинные строки.
 * Экспорт для unit-проверок в scripts/paykeeper-protocol-check.ts.
 */
export function sanitizePayloadForPaykeeperLog(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;

  const out: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]';
      continue;
    }
    if (key === 'key' && typeof raw === 'string') {
      const h = raw.trim();
      out[key] = h.length > 12 ? `${h.slice(0, 8)}…` : '[short]';
      continue;
    }
    out[key] = sanitizeValue(raw);
  }

  let json = JSON.stringify(out);
  if (json.length > MAX_PAYLOAD_CHARS) {
    json = `${json.slice(0, MAX_PAYLOAD_CHARS)}…[truncated]`;
    return { _truncated: true, snippet: json } as Record<string, unknown>;
  }
  return JSON.parse(json) as Record<string, unknown>;
}

function sanitizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') {
    let s = v;
    if (/^[a-f0-9]{16,}$/i.test(s.trim())) return '[looks_like_token]';
    if (s.length > MAX_STRING) s = `${s.slice(0, MAX_STRING)}…`;
    return s;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map((x) => sanitizeValue(x));
  if (typeof v === 'object') {
    return sanitizePayloadForPaykeeperLog(v as Record<string, unknown>);
  }
  return String(v).slice(0, MAX_STRING);
}

export async function writePaykeeperIntegrationLog(input: PaykeeperIntegrationLogInput): Promise<void> {
  try {
    const safe = sanitizePayloadForPaykeeperLog(input.payload ?? null);
    await prisma.paykeeperIntegrationLog.create({
      data: {
        direction: input.direction,
        event: input.event,
        status: input.status,
        orderNumber: input.orderNumber?.trim() || null,
        invoiceUrl: input.invoiceUrl?.trim() || null,
        httpStatus: input.httpStatus ?? null,
        message: input.message ? input.message.slice(0, MAX_MESSAGE) : null,
        payload: safe ? JSON.stringify(safe) : null,
      },
    });
  } catch (e) {
    console.error('[PaykeeperIntegrationLog] write failed', e);
  }
}
