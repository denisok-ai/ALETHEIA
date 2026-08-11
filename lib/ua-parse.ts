/**
 * Разбор User-Agent в «системное окружение» для мониторинга посещений
 * (docs/Monitoring-Plan.md §2.4): браузер, ОС, тип устройства.
 *
 * Сознательно без зависимости (ua-parser-js и т.п.): для админ-экрана хватает
 * основных семейств, а рунет-специфику (Яндекс.Браузер) готовые библиотеки
 * часто показывают как «Chrome». Порядок проверок важен: YaBrowser/Edg/OPR
 * содержат в строке и Chrome, и Safari.
 */

export type UaEnvironment = {
  /** «Яндекс.Браузер 24», «Chrome 126», «Safari 17»… или «—» */
  browser: string;
  /** «Windows 10/11», «macOS», «iOS 17», «Android 14», «Linux»… или «—» */
  os: string;
  device: 'Компьютер' | 'Телефон' | 'Планшет' | 'Бот' | '—';
};

const BOT_RE =
  /(bot|crawler|spider|slurp|curl\/|wget\/|python-requests|telegrambot|whatsapp|facebookexternalhit|vkshare|yandex\.com\/bots)/i;

function major(version: string | undefined): string {
  const m = version?.match(/^(\d+)/);
  return m ? ` ${m[1]}` : '';
}

function detectBrowser(ua: string): string {
  // Порядок: производные Chromium раньше Chrome, iOS-обёртки раньше Safari.
  const rules: [RegExp, string][] = [
    [/YaBrowser\/([\d.]+)/, 'Яндекс.Браузер'],
    [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
    [/(?:OPR|Opera)\/([\d.]+)/, 'Opera'],
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/CriOS\/([\d.]+)/, 'Chrome'],
    [/FxiOS\/([\d.]+)/, 'Firefox'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ];
  for (const [re, name] of rules) {
    const m = ua.match(re);
    if (m) return `${name}${major(m[1])}`;
  }
  if (/Safari/.test(ua)) return 'Safari';
  return '—';
}

function detectOs(ua: string): string {
  const win = ua.match(/Windows NT ([\d.]+)/);
  if (win) {
    // NT 10.0 — это и Windows 10, и 11: UA их не различает.
    const map: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
    const v = map[win[1]];
    return v ? `Windows ${v}` : 'Windows';
  }
  const ios = ua.match(/(?:iPhone|CPU) OS (\d+)[_.]/);
  if (ios) return `iOS ${ios[1]}`;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  const android = ua.match(/Android ([\d.]+)/);
  if (android) return `Android${major(android[1])}`;
  if (/Android/.test(ua)) return 'Android';
  const mac = ua.match(/Mac OS X (\d+)[_.](\d+)/);
  if (mac) {
    // До macOS 11 значима минорная версия (10.15), после — только мажорная.
    return mac[1] === '10' ? `macOS ${mac[1]}.${mac[2]}` : `macOS ${mac[1]}`;
  }
  if (/Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return '—';
}

function detectDevice(ua: string): UaEnvironment['device'] {
  if (/iPad|Tablet|tablet/.test(ua)) return 'Планшет';
  // «Android» без «Mobile» — планшет по соглашению Chromium.
  if (/Android(?!.*Mobile)/.test(ua) && /Android/.test(ua) && !/Mobile/.test(ua)) return 'Планшет';
  if (/Mobi|iPhone|iPod/.test(ua)) return 'Телефон';
  return 'Компьютер';
}

export function parseUserAgent(ua: string | null | undefined): UaEnvironment {
  const s = (ua ?? '').trim();
  if (!s) return { browser: '—', os: '—', device: '—' };
  if (BOT_RE.test(s)) {
    const name = s.match(BOT_RE)?.[1] ?? 'bot';
    return { browser: name, os: '—', device: 'Бот' };
  }
  return { browser: detectBrowser(s), os: detectOs(s), device: detectDevice(s) };
}
