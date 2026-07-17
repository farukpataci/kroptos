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
      {
        source: '/sektorler/ev-ve-bahce',
        destination: '/tr/industry/home-and-garden',
      },
      {
        source: '/:locale([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)/sektorler/ev-ve-bahce',
        destination: '/:locale/industry/home-and-garden',
      },
      {
        source: '/industries/home-and-garden',
        destination: '/en/industry/home-and-garden',
      },
      {
        source: '/:locale([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)/industries/home-and-garden',
        destination: '/:locale/industry/home-and-garden',
      },
    ];
  },
};

module.exports = nextConfig;
