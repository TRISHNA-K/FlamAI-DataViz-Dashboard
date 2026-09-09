/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabling duplicate mounts in development helps canvas performance profiling
  swcMinify: true,
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
