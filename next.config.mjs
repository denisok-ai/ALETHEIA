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
  async headers() {
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
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "frame-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
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
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60,
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
