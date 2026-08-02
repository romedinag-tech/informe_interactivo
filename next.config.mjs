/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions se usan para las mutaciones (crear/resolver observaciones).
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
