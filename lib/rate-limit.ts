/**
 * In-memory rate limiter for API routes (IP-based).
 * For multi-instance deploy, replace with Redis or similar.
 */

const windowMs = 60 * 1000; // 1 minute
const store = new Map<string, { count: number; resetAt: number }>();

function getKey(prefix: string, ip: string): string {
  return `${prefix}:${ip}`;
}

function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}

/**
 * Check rate limit. Returns null if allowed, or NextResponse with 429 if exceeded.
 * @param request - Request object (for headers)
 * @param prefix - Unique key prefix per endpoint (e.g. 'register', 'contact')
 * @param maxPerWindow - Max requests per window (e.g. 5)
 */
export function checkRateLimit(
  request: Request,
  prefix: string,
  maxPerWindow: number
): Response | null {
  const ip = getClientIp(request);
  const key = getKey(prefix, ip);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return null;
  }

  entry.count += 1;
  if (entry.count > maxPerWindow) {
    return new Response(
      JSON.stringify({ error: 'Слишком много запросов. Попробуйте позже.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}
