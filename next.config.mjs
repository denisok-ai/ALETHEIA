import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Как у Next без «внешнего» @opentelemetry/api: иначе dev бандлит OTEL в vendor-chunks и worker падает с MODULE_NOT_FOUND. */
const nextCompiledOtelApi = join(
  __dirname,
  'node_modules',
  'next',
  'dist',
  'compiled',
  '@opentelemetry',
  'api',
);
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

function shortGitRef(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  return s.length >= 7 ? s.slice(0, 7) : s;
}

function readGitHeadShort() {
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Попадает в NEXT_PUBLIC_BUILD_COMMIT (видно в UI и /api/health). Порядок: CI/env → локальный git. */
const buildCommit =
  shortGitRef(process.env.VERCEL_GIT_COMMIT_SHA) ||
  shortGitRef(process.env.CI_COMMIT_SHORT_SHA) ||
  shortGitRef(process.env.BUILD_COMMIT) ||
  shortGitRef(process.env.GITHUB_SHA) ||
  readGitHeadShort() ||
  '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? '0.0.0',
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
  },
  reactStrictMode: true,
  compress: true,
  // Убирает заголовок `X-Powered-By: Next.js` — не раскрываем стек и версию
  // фреймворка сканерам (информационное раскрытие, аудит безопасности 31.08.2026).
  poweredByHeader: false,
  async headers() {
    // CSP вынесена в middleware.ts (lib/csp.ts): политика зависит от маршрута
    // (unsafe-eval выдаётся ТОЧЕЧНО — только на SCORM-плеере /play и контенте
    // курсов), а два CSP-заголовка (next.config + middleware) браузер складывает
    // в пересечение. Здесь — только заголовки, одинаковые на всех путях.
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()',
      },
    ];
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: '/courses',
        destination: '/course/navyki-myshechnogo-testirovaniya',
        permanent: true,
      },
      /** Основной лендинг курса: /course/probuzhdenie */
      {
        source: '/course/probuzhdenie-berlinska',
        destination: '/course/probuzhdenie',
        permanent: true,
      },
      {
        source: '/course/probuzhdenie-spokoynaya',
        destination: '/course/probuzhdenie',
        permanent: true,
      },
    ];
  },
  images: {
    // AVIF первым: он даёт заметно меньший вес (обложка «Пробуждения» —
    // 2.9 МБ PNG → 259 КБ AVIF), а браузеры без поддержки получат webp.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    /**
     * 30 дней вместо минуты.
     *
     * С TTL в 60 секунд картинки отдавались с
     * `Cache-Control: max-age=60, must-revalidate`: посетитель перезапрашивал
     * их буквально каждую минуту, а на промахе кэша сервер заново пережимал
     * PNG в AVIF. Это било и по скорости страницы (Core Web Vitals — фактор
     * ранжирования), и по процессору.
     *
     * Год не ставим: картинки из /public адресуются по пути, а не по хешу
     * содержимого, поэтому заменённый файл сохраняет прежний URL и висел бы
     * у посетителей в кэше весь срок. Если картинку нужно поменять раньше —
     * загружайте её под новым именем.
     */
    minimumCacheTTL: 2592000,
  },
  /**
   * Dev: без этого Next.js блокирует `/_next/*` для origin туннеля → ChunkLoadError при открытии через trycloudflare / localtunnel.
   * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
   */
  allowedDevOrigins: [
    '127.0.0.1',
    '::1',
    '*.trycloudflare.com',
    '*.loca.lt',
    '*.ngrok-free.app',
    '*.ngrok.io',
  ],
  experimental: {
    /** lucide не в optimizePackageImports: с Turbopack + RSC иконки на сервере давали TypeError «null (reading 'useContext')». */
    instrumentationHook: true,
  },
  // instrumentation / server: встроенный `crypto` не должен резолвиться как npm-пакет.
  webpack: (config, { isServer }) => {
    if (!isServer) return config;
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@opentelemetry/api': nextCompiledOtelApi,
    };
    const ext = config.externals;
    if (Array.isArray(ext)) {
      ext.push('crypto', 'node:crypto');
    } else if (ext != null) {
      config.externals = [ext, 'crypto', 'node:crypto'];
    } else {
      config.externals = ['crypto', 'node:crypto'];
    }
    return config;
  },
};

export default nextConfig;
