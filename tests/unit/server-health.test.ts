/**
 * Пороги алерта ресурсов сервера. Кейсы:
 * - 25.09.2026: swap 51 % при 39 % доступной памяти и нулевом свопинге —
 *   холодные страницы, не тревога;
 * - 12.10.2026: swap 86 % — тревога, но виновник (ofelia, WARP) был не виден;
 *   теперь компонент у потолка своего бюджета называется в алерте.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateHealthProblems,
  parseOomVictims,
  shortContainerName,
  topComponentsLine,
  type ComponentMemory,
} from '@/lib/server-health';

const base = {
  memTotalMb: 3916,
  memAvailableMb: 1520,
  memAvailablePct: 39,
  swapTotalMb: 1024,
  swapUsedMb: 522,
  swapUsedPct: 51,
  diskUsedPct: 35,
  diskFreeGb: 55,
  oomKillsRecent: 0,
  oomVictims: [] as string[],
  components: [] as ComponentMemory[],
};

const texts = (h: typeof base) => evaluateHealthProblems(h).map((p) => p.text);
const keys = (h: typeof base) => evaluateHealthProblems(h).map((p) => p.key);

describe('server-health: пороги', () => {
  it('swap наполовину при достаточной RAM — не проблема', () => {
    expect(texts(base)).toEqual([]);
  });

  it('swap > 50 % при нехватке RAM — тревога', () => {
    const p = texts({ ...base, memAvailablePct: 25, memAvailableMb: 980 });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/^swap/);
  });

  it('swap почти исчерпан — тревога даже при свободной RAM', () => {
    expect(texts({ ...base, swapUsedPct: 90, swapUsedMb: 922 })[0]).toMatch(/^swap/);
  });

  it('память, диск и OOM ловятся независимо', () => {
    const p = keys({ ...base, memAvailablePct: 10, memAvailableMb: 390, diskUsedPct: 85, oomKillsRecent: 2, oomVictims: ['ofelia', 'ofelia'] });
    expect(p).toEqual(['mem', 'swap', 'disk', 'oom:ofelia']);
  });
});

describe('server-health: бюджет памяти компонентов', () => {
  const comps: ComponentMemory[] = [
    { name: 'aletheia', anonMb: 530, swapMb: 0, maxMb: 1024 },
    { name: 'ofelia', anonMb: 60, swapMb: 0, maxMb: 64 },
    { name: 'dovecot', anonMb: 55, swapMb: 0, maxMb: null },
  ];

  it('компонент ≥ 90 % своего потолка — называется в алерте', () => {
    const p = evaluateHealthProblems({ ...base, components: comps });
    expect(p.map((x) => x.key)).toEqual(['limit:ofelia']);
    expect(p[0].text).toContain('ofelia у потолка памяти: 60/64 МБ');
  });

  it('без потолка или с запасом — не проблема', () => {
    expect(keys({ ...base, components: [comps[0], comps[2]] })).toEqual([]);
  });

  it('ключи без цифр: рост swap 885 → 887 МБ — тот же алерт (антиспам)', () => {
    const a = keys({ ...base, swapUsedPct: 86, swapUsedMb: 885 });
    const b = keys({ ...base, swapUsedPct: 87, swapUsedMb: 887 });
    expect(a).toEqual(b);
  });

  it('строка топа потребителей', () => {
    expect(topComponentsLine([{ name: 'sogo', anonMb: 250, swapMb: 40, maxMb: 512 }, comps[0]])).toBe(
      'sogo 250+40 swap · aletheia 530'
    );
  });

  it('имена контейнеров mailcow укорачиваются', () => {
    expect(shortContainerName('/mailcowdockerized-rspamd-mailcow-1')).toBe('rspamd');
  });
});

describe('server-health: OOM из журнала ядра', () => {
  it('одно событие = одна жертва, хотя строк в журнале несколько', () => {
    const journal = [
      'kernel: ofelia invoked oom-killer: gfp_mask=0xcc0(GFP_KERNEL), order=0, oom_score_adj=0',
      'kernel: oom-kill:constraint=CONSTRAINT_MEMCG,nodemask=(null),cpuset=docker-abc.scope',
      'kernel: Memory cgroup out of memory: Killed process 4242 (ofelia) total-vm:812345kB, anon-rss:65000kB',
    ].join('\n');
    expect(parseOomVictims(journal)).toEqual(['ofelia']);
  });
});
