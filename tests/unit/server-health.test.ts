/**
 * Пороги алерта ресурсов сервера. Кейс 25.09.2026: swap 51 % при 39 % доступной
 * памяти и нулевом свопинге — холодные страницы, не тревога.
 */
import { describe, expect, it } from 'vitest';
import { evaluateHealthProblems } from '@/lib/server-health';

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
};

describe('server-health: пороги', () => {
  it('swap наполовину при достаточной RAM — не проблема', () => {
    expect(evaluateHealthProblems(base)).toEqual([]);
  });

  it('swap > 50 % при нехватке RAM — тревога', () => {
    const p = evaluateHealthProblems({ ...base, memAvailablePct: 25, memAvailableMb: 980 });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/^swap/);
  });

  it('swap почти исчерпан — тревога даже при свободной RAM', () => {
    expect(evaluateHealthProblems({ ...base, swapUsedPct: 90, swapUsedMb: 922 })[0]).toMatch(/^swap/);
  });

  it('память, диск и OOM ловятся независимо', () => {
    const p = evaluateHealthProblems({ ...base, memAvailablePct: 10, memAvailableMb: 390, diskUsedPct: 85, oomKillsRecent: 2 });
    expect(p.map((x) => x.split(':')[0])).toEqual(['память', 'swap', 'диск', 'OOM-kill за 20 мин']);
  });
});
