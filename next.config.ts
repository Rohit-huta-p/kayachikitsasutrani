// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects: async () => [
      {
          source: '/',
          destination: '/home',
          permanent: true,
      },
  ],
};

module.exports = nextConfig;