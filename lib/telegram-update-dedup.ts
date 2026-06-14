/**
 * Дедупликация update_id между webhook и poll-worker (разные процессы).
 * In-memory + файл в TELEGRAM_POLL_STATE_DIR, TTL 1 ч.
 */
import fs from 'node:fs';
import path from 'node:path';

const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 10_000;

const mem = new Map<number, number>();

function stateDir(): string {
  return process.env.TELEGRAM_POLL_STATE_DIR?.trim() || '/var/lib/aletheia';
}

function stateFile(): string {
  return path.join(stateDir(), 'processed-update-ids.json');
}

type PersistedState = { ids: Record<string, number> };

function loadFile(): PersistedState {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { ids: parsed.ids && typeof parsed.ids === 'object' ? parsed.ids : {} };
  } catch {
    return { ids: {} };
  }
}

function purge(now: number, ids: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [k, t] of Object.entries(ids)) {
    if (now - t < TTL_MS) next[k] = t;
  }
  return next;
}

function saveFile(ids: Record<string, number>): void {
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify({ ids }, null, 0), 'utf8');
  } catch (e) {
    console.warn('[telegram-dedup] save failed', e);
  }
}

function purgeMem(now: number): void {
  mem.forEach((t, id) => {
    if (now - t >= TTL_MS) mem.delete(id);
  });
}

/** true — обрабатываем впервые; false — уже видели (webhook + poll или повтор). */
export function claimTelegramUpdate(updateId: number | undefined): boolean {
  if (updateId == null || !Number.isFinite(updateId)) return true;

  const now = Date.now();
  purgeMem(now);

  const memTs = mem.get(updateId);
  if (memTs != null && now - memTs < TTL_MS) return false;

  const file = loadFile();
  let ids = purge(now, file.ids);
  const fileTs = ids[String(updateId)];
  if (fileTs != null && now - fileTs < TTL_MS) {
    mem.set(updateId, fileTs);
    return false;
  }

  mem.set(updateId, now);
  ids[String(updateId)] = now;

  const keys = Object.keys(ids);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => ({ k, t: ids[k] ?? 0 }))
      .sort((a, b) => a.t - b.t)
      .slice(keys.length - MAX_ENTRIES);
    ids = Object.fromEntries(sorted.map(({ k, t }) => [k, t]));
  }

  saveFile(ids);
  return true;
}
