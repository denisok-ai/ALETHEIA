/**
 * Адреса, с которых ЮKassa шлёт HTTP-уведомления (справочник «Уведомления», API-changelog).
 * Проверка по IP — необязательный второй слой (тумблер yookassa_ip_check); доверие
 * основано на повторном GET платежа через API, IP-фильтр лишь отсекает лишний шум.
 */
export const YOOKASSA_NOTIFICATION_CIDRS = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11/32',
  '77.75.156.35/32',
  '77.75.154.128/25',
  '2a02:5180::/32',
] as const;

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** IPv4 → 4 байта. */
function parseIPv4(ip: string): number[] | null {
  const m = IPV4_RE.exec(ip.trim());
  if (!m) return null;
  const bytes: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const octet = Number(m[i]);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    bytes.push(octet);
  }
  return bytes;
}

/** IPv6 → 16 байт (поддерживает «::» и сокращения групп). */
function parseIPv6(ip: string): number[] | null {
  let s = ip.trim().toLowerCase();
  if (!s || !s.includes(':')) return null;
  const zoneIdx = s.indexOf('%');
  if (zoneIdx >= 0) s = s.slice(0, zoneIdx);

  const doubleColon = s.split('::');
  if (doubleColon.length > 2) return null;

  const toGroups = (part: string): string[] | null => {
    if (part === '') return [];
    const groups = part.split(':');
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    }
    return groups;
  };

  let groups: string[];
  if (doubleColon.length === 2) {
    const head = toGroups(doubleColon[0]);
    const tail = toGroups(doubleColon[1]);
    if (!head || !tail) return null;
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    const all = toGroups(s);
    if (!all || all.length !== 8) return null;
    groups = all;
  }

  const bytes: number[] = [];
  for (const g of groups) {
    const v = parseInt(g, 16);
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  return bytes;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [base, prefixRaw] = cidr.split('/');
  const prefix = Number(prefixRaw);
  const isV4 = base.includes('.');
  const bits = isV4 ? 32 : 128;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false;

  const value = isV4 ? parseIPv4(ip) : parseIPv6(ip);
  const network = isV4 ? parseIPv4(base) : parseIPv6(base);
  if (!value || !network) return false;

  // Сравниваем побитно первые prefix бит.
  let remaining = prefix;
  for (let i = 0; i < network.length && remaining > 0; i++) {
    const take = Math.min(8, remaining);
    const mask = (0xff << (8 - take)) & 0xff;
    if ((value[i] & mask) !== (network[i] & mask)) return false;
    remaining -= take;
  }
  return true;
}

/** true, если IP входит в список уведомлений ЮKassa. Пустой/непарсящийся адрес — false. */
export function isYooKassaIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  return YOOKASSA_NOTIFICATION_CIDRS.some((cidr) => matchesCidr(ip, cidr));
}
