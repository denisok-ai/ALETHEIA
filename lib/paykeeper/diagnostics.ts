/**
 * Диагностика PayKeeper для админки: токен, список ПС, ошибки.
 */

import type { PayKeeperConfig } from '@/lib/paykeeper/types';
import { paykeeperHttp, refreshPayKeeperToken } from '@/lib/paykeeper/http';
import { formatPayKeeperConnectionError } from '@/lib/paykeeper/errors';

export type PaykeeperHealthCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

export async function runPaykeeperHealthChecks(cfg: PayKeeperConfig): Promise<PaykeeperHealthCheck[]> {
  const checks: PaykeeperHealthCheck[] = [];

  const server = cfg.server;
  checks.push({
    name: 'DNS / HTTPS (токен)',
    ok: false,
    detail: 'проверка…',
  });
  const tokenIdx = checks.length - 1;

  try {
    await refreshPayKeeperToken(cfg);
    checks[tokenIdx] = {
      name: 'DNS / HTTPS (токен)',
      ok: true,
      detail: `Сервер ${server}: токен получен`,
    };
  } catch (e) {
    checks[tokenIdx] = {
      name: 'DNS / HTTPS (токен)',
      ok: false,
      detail: formatPayKeeperConnectionError(e, server),
    };
  }

  checks.push({ name: 'Платёжные системы (/info/systems/list/)', ok: false, detail: '…' });
  const sysIdx = checks.length - 1;
  try {
    const { status, text, json } = await paykeeperHttp(cfg, {
      method: 'GET',
      path: '/info/systems/list/',
      skipFailGuard: true,
      skipToken: true,
      logContext: 'systems.list',
    });
    if (status >= 200 && status < 300) {
      const n = Array.isArray(json) ? json.length : json && typeof json === 'object' ? 1 : 0;
      checks[sysIdx] = {
        name: 'Платёжные системы (/info/systems/list/)',
        ok: true,
        detail: `HTTP ${status}, записей: ${n}`,
      };
    } else {
      checks[sysIdx] = {
        name: 'Платёжные системы (/info/systems/list/)',
        ok: false,
        detail: `HTTP ${status}: ${text.slice(0, 120)}`,
      };
    }
  } catch (e) {
    checks[sysIdx] = {
      name: 'Платёжные системы (/info/systems/list/)',
      ok: false,
      detail: formatPayKeeperConnectionError(e, server),
    };
  }

  checks.push({ name: 'Счётчик ошибок (/info/errors/total/)', ok: false, detail: '…' });
  const errIdx = checks.length - 1;
  try {
    const { status, text, json } = await paykeeperHttp(cfg, {
      method: 'GET',
      path: '/info/errors/total/',
      skipFailGuard: true,
      skipToken: true,
      logContext: 'errors.total',
    });
    if (status >= 200 && status < 300) {
      checks[errIdx] = {
        name: 'Счётчик ошибок (/info/errors/total/)',
        ok: true,
        detail: typeof text === 'string' ? text.slice(0, 200) : JSON.stringify(json).slice(0, 200),
      };
    } else {
      checks[errIdx] = {
        name: 'Счётчик ошибок (/info/errors/total/)',
        ok: false,
        detail: `HTTP ${status} (метод может быть отключён)`,
      };
    }
  } catch (e) {
    checks[errIdx] = {
      name: 'Счётчик ошибок (/info/errors/total/)',
      ok: false,
      detail: formatPayKeeperConnectionError(e, server),
    };
  }

  return checks;
}
