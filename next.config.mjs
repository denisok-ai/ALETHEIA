/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60,
  },
  // optimizePackageImports отключён — может ломать чанки при сборке (vendor-chunks/next.js)
  // experimental: { optimizePackageImports: ['lucide-react', 'framer-motion'] },
};

export default nextConfig;
