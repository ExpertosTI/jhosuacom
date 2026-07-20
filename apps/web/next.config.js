/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Proxy /api → Nest en runtime (route handler app/api/[...path]).
  // No usar NEXT_PUBLIC_API_URL aquí: en builds viejos era URL pública → loop/502.
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
