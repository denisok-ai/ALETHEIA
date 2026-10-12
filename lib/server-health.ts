/**
 * Здоровье сервера: память, swap, диск, OOM-kill и бюджет памяти компонентов.
 *
 * Зачем: 21.09.2026 VPS ужат до 4 ГБ ради экономии. Запас ~1.7 ГБ, и без
 * алерта первый OOM мы узнали бы от пользователей. Cron дёргает
 * `checkServerHealth` каждые 15 минут и шлёт админам, если порог пробит.
 *
 * Компоненты (12.10.2026): у каждой службы сайта и контейнера mailcow свой
 * потолок памяти (scripts/install-memory-budget.sh). Здесь читаем cgroup v2:
 * кто сколько держит (anon + swap) и кто упёрся в свой потолок — алерт сразу
 * называет виновника, а не только «swap 86 %».
 *
 * Читаем /proc и /sys напрямую (без внешних утилит), диск — fs.statfs. OOM-kill —
 * из kernel-журнала через journalctl; если прав нет, метрика пропускается,
 * а не валит проверку.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Память одного компонента (systemd-служба или docker-контейнер). */
export type ComponentMemory = {
  name: string;
  anonMb: number; // память процессов (без файлового кэша — его ядро отдаст само)
  swapMb: number;
  maxMb: number | null; // потолок cgroup; null — без потолка
};

export type HealthProblem = {
  /** Вид проблемы без цифр — для антиспама: тот же key не повторяем 6 ч. */
  key: string;
  text: string;
};

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
  oomVictims: string[]; // имена убитых процессов
  components: ComponentMemory[]; // по убыванию anon + swap
  problems: string[]; // человекочитаемые пробитые пороги
  problemKeys: string[];
};

/**
 * Пороги: available < 15 % памяти, диск > 80 %, любой OOM. Swap сам по себе не
 * проблема: ядро выносит туда холодные страницы (rspamd, mailcow) и держит их,
 * даже когда RAM свободна (25.09: swap 51 % при 39 % доступной памяти и нулевом
 * свопинге — ложная тревога). Тревога по swap — только если он почти исчерпан
 * либо заполняется при одновременной нехватке RAM.
 *
 * Компонент «у потолка» — anon ≥ 90 % его лимита: следующий шаг — swap внутри
 * cgroup или OOM-kill компонента. Это ранний сигнал утечки (12.10: ofelia).
 */
const MEM_AVAILABLE_MIN_PCT = 15;
const SWAP_USED_MAX_PCT = 85;
const SWAP_PRESSURE_PCT = 50;
const SWAP_PRESSURE_MEM_AVAILABLE_PCT = 30;
const DISK_USED_MAX_PCT = 80;
const COMPONENT_AT_LIMIT_PCT = 90;

const CGROUP_ROOT = '/sys/fs/cgroup/system.slice';
const DOCKER_CONTAINERS = '/var/lib/docker/containers';

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

const mb = (bytes: number) => Math.round(bytes / 1048576);

function readNumber(file: string): number | null {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    return raw === 'max' ? null : Number(raw);
  } catch {
    return null;
  }
}

/** «mailcowdockerized-rspamd-mailcow-1» → «rspamd». */
export function shortContainerName(name: string): string {
  return name.replace(/^\//, '').replace(/^mailcowdockerized-/, '').replace(/-mailcow-\d+$/, '');
}

function dockerName(id: string): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(DOCKER_CONTAINERS, id, 'config.v2.json'), 'utf8')) as {
      Name?: string;
    };
    return cfg.Name ? shortContainerName(cfg.Name) : id.slice(0, 12);
  } catch {
    return id.slice(0, 12);
  }
}

/** Службы и контейнеры из cgroup v2. Без cgroup (не Linux, нет прав) — пусто. */
function readComponents(): ComponentMemory[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(CGROUP_ROOT);
  } catch {
    return [];
  }
  const out: ComponentMemory[] = [];
  for (const e of entries) {
    const docker = e.match(/^docker-([0-9a-f]{64})\.scope$/);
    if (!docker && !e.endsWith('.service')) continue;
    const dir = path.join(CGROUP_ROOT, e);
    let anon = 0;
    try {
      const m = fs.readFileSync(path.join(dir, 'memory.stat'), 'utf8').match(/^anon (\d+)$/m);
      anon = m ? Number(m[1]) : 0;
    } catch {
      continue;
    }
    const swap = readNumber(path.join(dir, 'memory.swap.current')) ?? 0;
    if (anon + swap < 8 * 1048576) continue; // мелочь не показываем
    const max = readNumber(path.join(dir, 'memory.max'));
    out.push({
      name: docker ? dockerName(docker[1]) : e.replace(/\.service$/, ''),
      anonMb: mb(anon),
      swapMb: mb(swap),
      maxMb: max == null ? null : mb(max),
    });
  }
  return out.sort((a, b) => b.anonMb + b.swapMb - (a.anonMb + a.swapMb));
}

/**
 * OOM-kill из журнала ядра. Считаем строки «Killed process N (name)» — одно
 * событие пишет в журнал несколько строк, прежний подсчёт по «out of memory»
 * завышал число.
 */
export function parseOomVictims(journal: string): string[] {
  return Array.from(journal.matchAll(/Killed process \d+ \(([^)]+)\)/g), (m) => m[1]);
}

async function readOomVictims(windowMinutes: number): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync(
      'journalctl',
      ['-k', '--since', `-${windowMinutes}min`, '--no-pager', '-q'],
      { timeout: 5000, maxBuffer: 1024 * 1024 }
    );
    return parseOomVictims(stdout);
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

  const victims = await readOomVictims(windowMinutes);

  const metrics = {
    memTotalMb: Math.round(memTotalMb),
    memAvailableMb: Math.round(memAvailableMb),
    memAvailablePct,
    swapTotalMb: Math.round(swapTotalMb),
    swapUsedMb: Math.round(swapUsedMb),
    swapUsedPct,
    diskUsedPct,
    diskFreeGb,
    oomKillsRecent: victims == null ? null : victims.length,
    oomVictims: victims ?? [],
    components: readComponents(),
  };
  const evaluated = evaluateHealthProblems(metrics, windowMinutes);
  return { ...metrics, problems: evaluated.map((p) => p.text), problemKeys: evaluated.map((p) => p.key) };
}

/** «next-server 530 · sogo 250+40 swap · rspamd 216» — кто держит память. */
export function topComponentsLine(components: ComponentMemory[], limit = 5): string {
  return components
    .slice(0, limit)
    .map((c) => `${c.name} ${c.anonMb}${c.swapMb ? `+${c.swapMb} swap` : ''}`)
    .join(' · ');
}

/** Пробитые пороги по снятым метрикам (чистая функция — покрыта тестами). */
export function evaluateHealthProblems(
  h: Omit<ServerHealth, 'problems' | 'problemKeys'>,
  windowMinutes = 20
): HealthProblem[] {
  const problems: HealthProblem[] = [];
  if (h.memTotalMb && h.memAvailablePct < MEM_AVAILABLE_MIN_PCT) {
    problems.push({ key: 'mem', text: `память: доступно ${h.memAvailableMb} МБ (${h.memAvailablePct} %)` });
  }
  const swapExhausted = h.swapUsedPct > SWAP_USED_MAX_PCT;
  const swapPressure =
    h.swapUsedPct > SWAP_PRESSURE_PCT && h.memAvailablePct < SWAP_PRESSURE_MEM_AVAILABLE_PCT;
  if (h.swapTotalMb && (swapExhausted || swapPressure)) {
    problems.push({
      key: 'swap',
      text: `swap: занято ${h.swapUsedMb} МБ (${h.swapUsedPct} %) при доступной памяти ${h.memAvailablePct} %`,
    });
  }
  for (const c of h.components) {
    if (c.maxMb && c.anonMb >= (c.maxMb * COMPONENT_AT_LIMIT_PCT) / 100) {
      problems.push({
        key: `limit:${c.name}`,
        text:
          `${c.name} у потолка памяти: ${c.anonMb}/${c.maxMb} МБ` +
          (c.swapMb ? ` (+${c.swapMb} МБ в swap)` : '') +
          ' — возможна утечка; при упоре будет перезапущен',
      });
    }
  }
  if (h.diskUsedPct > DISK_USED_MAX_PCT) {
    problems.push({ key: 'disk', text: `диск: занято ${h.diskUsedPct} %, свободно ${h.diskFreeGb} ГБ` });
  }
  if (h.oomKillsRecent) {
    const names = Array.from(new Set(h.oomVictims));
    problems.push({
      key: `oom:${names.join(',')}`,
      text:
        `OOM-kill за ${windowMinutes} мин: ${h.oomKillsRecent}` +
        (names.length ? ` (${names.join(', ')}) — компонент перезапускается автоматически` : ''),
    });
  }
  return problems;
}
