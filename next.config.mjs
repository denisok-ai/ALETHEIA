import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
    ];
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60,
  },
  experimental: {
    /** lucide не в optimizePackageImports: с Turbopack + RSC иконки на сервере давали TypeError «null (reading 'useContext')». */
    instrumentationHook: true,
  },
  // instrumentation / server: встроенный `crypto` не должен резолвиться как npm-пакет.
  webpack: (config, { isServer }) => {
    if (!isServer) return config;
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
