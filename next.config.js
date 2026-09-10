/** @type {import('next').NextConfig} */

const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? (() => {
        try {
          return require('@next/bundle-analyzer')({ enabled: true });
        } catch {
          console.warn('[@next/bundle-analyzer] not installed, falling back to standard build');
          return (config) => config;
        }
      })()
    : (config) => config;

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Standalone output enabled conditionally to prevent Windows/OneDrive symlink readlink issues
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,

  experimental: {
    // Tree-shake Lucide icon imports for minimal client JavaScript bundles
    optimizePackageImports: ['lucide-react'],
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Client bundle chunk splitting optimization
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            chunks: 'all',
            name: 'framework',
            test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
            priority: 40,
            enforce: true,
          },
          charts: {
            name: 'charts-engine',
            test: /[\\/]components[\\/]charts[\\/]/,
            chunks: 'all',
            priority: 30,
            reuseExistingChunk: true,
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
        },
      };
    }
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
