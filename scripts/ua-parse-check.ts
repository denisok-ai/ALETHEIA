/**
 * Проверка lib/ua-parse.ts на реальных User-Agent строках.
 *   npx tsx scripts/ua-parse-check.ts
 */
import { parseUserAgent, type UaEnvironment } from '../lib/ua-parse';

const CASES: { name: string; ua: string; expect: UaEnvironment }[] = [
  {
    name: 'Chrome / Windows 10',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    expect: { browser: 'Chrome 126', os: 'Windows 10/11', device: 'Компьютер' },
  },
  {
    name: 'Яндекс.Браузер / Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 YaBrowser/24.4.0.0 Safari/537.36',
    expect: { browser: 'Яндекс.Браузер 24', os: 'Windows 10/11', device: 'Компьютер' },
  },
  {
    name: 'Safari / iPhone',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    expect: { browser: 'Safari 17', os: 'iOS 17', device: 'Телефон' },
  },
  {
    name: 'Chrome / Android телефон',
    ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    expect: { browser: 'Chrome 125', os: 'Android 14', device: 'Телефон' },
  },
  {
    name: 'Chrome / Android планшет (без Mobile)',
    ua: 'Mozilla/5.0 (Linux; Android 13; SM-X510) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    expect: { browser: 'Chrome 124', os: 'Android 13', device: 'Планшет' },
  },
  {
    name: 'Safari / macOS Sonoma',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    expect: { browser: 'Safari 17', os: 'macOS 10.15', device: 'Компьютер' },
  },
  {
    name: 'Edge / Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    expect: { browser: 'Edge 126', os: 'Windows 10/11', device: 'Компьютер' },
  },
  {
    name: 'Firefox / Linux',
    ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
    expect: { browser: 'Firefox 126', os: 'Linux', device: 'Компьютер' },
  },
  {
    name: 'Chrome / iPad (CriOS)',
    ua: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1',
    expect: { browser: 'Chrome 124', os: 'iOS 17', device: 'Планшет' },
  },
  {
    name: 'TelegramBot',
    ua: 'TelegramBot (like TwitterBot)',
    expect: { browser: 'TelegramBot', os: '—', device: 'Бот' },
  },
  {
    name: 'Пустой UA',
    ua: '',
    expect: { browser: '—', os: '—', device: '—' },
  },
];

let failed = 0;
for (const c of CASES) {
  const got = parseUserAgent(c.ua);
  const ok =
    got.browser === c.expect.browser && got.os === c.expect.os && got.device === c.expect.device;
  if (ok) {
    console.log(`  ok       ${c.name}`);
  } else {
    failed++;
    console.log(`  FAIL     ${c.name}`);
    console.log(`           ожидалось: ${JSON.stringify(c.expect)}`);
    console.log(`           получено:  ${JSON.stringify(got)}`);
  }
}

if (failed > 0) {
  console.log(`\nПровалено: ${failed} из ${CASES.length}`);
  process.exit(1);
}
console.log(`\nВсе ${CASES.length} проверок пройдены.`);
