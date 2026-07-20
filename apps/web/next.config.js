/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // Browser → /api/* → Next (este contenedor) → Nest interno en Swarm
  async rewrites() {
    const internal = (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://jhosuacom_api:3000'
    ).replace(/\/$/, '');
    // Si apunta a path relativo, usar servicio Swarm por defecto
    const target = internal.startsWith('http')
      ? internal
      : 'http://jhosuacom_api:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
