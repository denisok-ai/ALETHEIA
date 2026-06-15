#!/usr/bin/env npx tsx
/**
 * Фоновый планировщик SMM/Site Radar (systemd: aletheia-jobs.service).
 */
import { startContentJobScheduler } from '../lib/content/jobs/scheduler';

console.log('[jobs-daemon] starting content job scheduler');

startContentJobScheduler();

// держим процесс живым
setInterval(() => {
  /* heartbeat */
}, 60_000);

process.on('SIGTERM', () => {
  console.log('[jobs-daemon] SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[jobs-daemon] SIGINT');
  process.exit(0);
});
