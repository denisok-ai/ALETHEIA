/**
 * Здоровье сервера: память, swap, диск, OOM-kill.
 *
 * Зачем: 21.09.2026 VPS ужат до 4 ГБ ради экономии. Запас ~1.7 ГБ, и без
 * алерта первый OOM мы узнали бы от пользователей. Cron дёргает
 * `checkServerHealth` каждые 15 минут и шлёт админам, если порог пробит.
 *
 * Читаем /proc напрямую (без внешних утилит), диск — fs.statfs. OOM-kill —
 * из kernel-журнала через journalctl; если прав нет, метрика пропускается,
 * а не валит проверку.
 */
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ServerHealth = {
  memTotalMb: number;
  memAvailableMb: number;
  memAvailablePct: number;
  swapTotalMb: number;
  swapUsedMb: number;
  swapUsedPct: number;
  diskUsedPct: number;
  diskFreeGb: number;
  oomKillsRecent: number | null; // null — журнал недоступен
  problems: string[]; // человекочитаемые пробитые пороги
};

/**
 * Пороги: available < 15 % памяти, диск > 80 %, любой OOM. Swap сам по себе не
 * проблема: ядро выносит туда холодные страницы (rspamd, mailcow) и держит их,
 * даже когда RAM свободна (25.09: swap 51 % при 39 % доступной памяти и нулевом
 * свопинге — ложная тревога). Тревога по swap — только если он почти исчерпан
 * либо заполняется при одновременной нехватке RAM.
 */
const MEM_AVAILABLE_MIN_PCT = 15;
const SWAP_USED_MAX_PCT = 85;
const SWAP_PRESSURE_PCT = 50;
const SWAP_PRESSURE_MEM_AVAILABLE_PCT = 30;
const DISK_USED_MAX_PCT = 80;

function readMeminfo(): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    for (const line of fs.readFileSync('/proc/meminfo', 'utf8').split('\n')) {
      const m = line.match(/^(\w+):\s+(\d+)\s*kB/);
      if (m) out[m[1]] = Number(m[2]) / 1024; // → МБ
    }
  } catch {
    /* не Linux — вернём пустое, пороги не сработают */
  }
  return out;
}

async function countOomKills(windowMinutes: number): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      'journalctl',
      ['-k', '--since', `-${windowMinutes}min`, '--no-pager', '-q'],
      { timeout: 5000, maxBuffer: 1024 * 1024 }
    );
    return stdout.split('\n').filter((l) => /out of memory|oom-kill|killed process/i.test(l)).length;
  } catch {
    return null;
  }
}

export async function checkServerHealth(windowMinutes = 20): Promise<ServerHealth> {
  const mi = readMeminfo();
  const memTotalMb = mi.MemTotal ?? 0;
  const memAvailableMb = mi.MemAvailable ?? 0;
  const memAvailablePct = memTotalMb ? Math.round((memAvailableMb / memTotalMb) * 100) : 100;
  const swapTotalMb = mi.SwapTotal ?? 0;
  const swapUsedMb = swapTotalMb ? swapTotalMb - (mi.SwapFree ?? 0) : 0;
  const swapUsedPct = swapTotalMb ? Math.round((swapUsedMb / swapTotalMb) * 100) : 0;

  let diskUsedPct = 0;
  let diskFreeGb = 0;
  try {
    const st = await fs.promises.statfs('/');
    const total = st.blocks * st.bsize;
    const free = st.bavail * st.bsize;
    diskUsedPct = total ? Math.round(((total - free) / total) * 100) : 0;
    diskFreeGb = Math.round((free / 1024 ** 3) * 10) / 10;
  } catch {
    /* statfs недоступен — пропускаем диск */
  }

  const oomKillsRecent = await countOomKills(windowMinutes);

  const metrics = {
    memTotalMb: Math.round(memTotalMb),
    memAvailableMb: Math.round(memAvailableMb),
    memAvailablePct,
    swapTotalMb: Math.round(swapTotalMb),
    swapUsedMb: Math.round(swapUsedMb),
    swapUsedPct,
    diskUsedPct,
    diskFreeGb,
    oomKillsRecent,
  };
  return { ...metrics, problems: evaluateHealthProblems(metrics, windowMinutes) };
}

/** Пробитые пороги по снятым метрикам (чистая функция — покрыта тестами). */
export function evaluateHealthProblems(h: Omit<ServerHealth, 'problems'>, windowMinutes = 20): string[] {
  const problems: string[] = [];
  if (h.memTotalMb && h.memAvailablePct < MEM_AVAILABLE_MIN_PCT) {
    problems.push(`память: доступно ${h.memAvailableMb} МБ (${h.memAvailablePct} %)`);
  }
  const swapExhausted = h.swapUsedPct > SWAP_USED_MAX_PCT;
  const swapPressure =
    h.swapUsedPct > SWAP_PRESSURE_PCT && h.memAvailablePct < SWAP_PRESSURE_MEM_AVAILABLE_PCT;
  if (h.swapTotalMb && (swapExhausted || swapPressure)) {
    problems.push(`swap: занято ${h.swapUsedMb} МБ (${h.swapUsedPct} %) при доступной памяти ${h.memAvailablePct} %`);
  }
  if (h.diskUsedPct > DISK_USED_MAX_PCT) {
    problems.push(`диск: занято ${h.diskUsedPct} %, свободно ${h.diskFreeGb} ГБ`);
  }
  if (h.oomKillsRecent) {
    problems.push(`OOM-kill за ${windowMinutes} мин: ${h.oomKillsRecent}`);
  }
  return problems;
}
