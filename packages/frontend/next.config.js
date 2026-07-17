/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  },
  async rewrites() {
    return [
      {
        source: '/:locale([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)/home',
        destination: '/:locale',
      },
    ];
  },
};

module.exports = nextConfig;
