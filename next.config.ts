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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

module.exports = nextConfig;