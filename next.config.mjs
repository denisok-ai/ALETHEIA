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
    const isDev = process.env.NODE_ENV !== 'production';
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()',
      },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // 'unsafe-eval' нужен только dev-режиму (горячая перезагрузка).
          // В проде проверено: ни в одном из собранных клиентских бандлов нет
          // eval()/new Function() — значит директива лишняя и снята.
          //
          // mc.yandex.ru ОБЯЗАТЕЛЕН: CSP от 10.07.2026 молча заблокировала
          // загрузку скрипта Яндекс.Метрики — счётчик 108390990 показывал
          // нули весь июль, хотя код Метрики был на сайте и до этого шёл
          // поисковый трафик (135 визитов за апрель–июнь). Блокировку никто
          // не заметил, потому что для посетителя сайт выглядел исправным.
          // mc.yandex.com — зеркало, на которое tag.js может переключаться.
          // GA (googletagmanager.com) и Clarity (clarity.ms) — «иностранные»
          // счётчики, включены 12.08.2026. Без этих доменов в script-src CSP
          // молча заблокирует скрипты, как это было с mc.yandex.ru.
          isDev
            ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://mc.yandex.com https://www.googletagmanager.com https://www.clarity.ms https://c.clarity.ms https://scripts.clarity.ms"
            : "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://mc.yandex.com https://www.googletagmanager.com https://www.clarity.ms https://c.clarity.ms https://scripts.clarity.ms",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          // Вебвизор Метрики работает через blob-worker — без worker-src
          // default-src 'self' молча блокирует запись сессий.
          "worker-src 'self' blob:",
          "connect-src 'self' https:",
          "frame-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ];

    /**
     * Строгая политика в режиме «только отчёты»: ничего не блокирует, но браузеры
     * присылают на /api/csp-report всё, что нарушило бы запрет 'unsafe-inline'.
     * Это безопасный способ собрать на реальном трафике список инлайн-скриптов
     * перед переходом на nonce — вслепую такую миграцию катить нельзя (16 блоков
     * JSON-LD и аналитика; ошибка молча убила бы разметку или счётчик).
     */
    if (!isDev) {
      securityHeaders.push({
        key: 'Content-Security-Policy-Report-Only',
        value: [
          "default-src 'self'",
          "script-src 'self' https://mc.yandex.ru https://mc.yandex.com https://www.googletagmanager.com https://www.clarity.ms https://c.clarity.ms https://scripts.clarity.ms",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          // Вебвизор Метрики работает через blob-worker — без worker-src
          // default-src 'self' молча блокирует запись сессий.
          "worker-src 'self' blob:",
          "connect-src 'self' https:",
          "frame-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          'report-uri /api/csp-report',
        ].join('; '),
      });
    }
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
