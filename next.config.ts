// next.config.js
/** @type {import('next').NextConfig} */

// Backend URL — used to proxy /api/* server-to-server so cookies become
// first-party from the browser's perspective (fixes Safari ITP blocking
// cross-site cookies between frontend and backend onrender subdomains).
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

const nextConfig = {
  redirects: async () => [
    {
      source: "/",
      destination: "/home",
      permanent: true,
    },
  ],
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: `${BACKEND_URL}/api/:path*`,
    },
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

module.exports = nextConfig;
