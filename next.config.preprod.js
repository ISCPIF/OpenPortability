const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com', 'cdn.bsky.app'],
  },
  poweredByHeader: false,
  compress: true,
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
    optimizePackageImports: ['lucide-react', '@heroicons/react', 'react-icons'],
  },

  // ✅ Fix pour embedding-atlas (asset/inline bug Next.js)
  webpack: (config, { isServer }) => {
    // Workaround pour Next.js qui override config.module.generator pour "asset"
    // Cela casse asset/inline - on doit séparer les configs
    // https://github.com/vercel/next.js/discussions/36981
    if (config.module.generator) {
      config.module.generator['asset/resource'] = config.module.generator.asset;
      config.module.generator['asset/source'] = config.module.generator.asset;
      delete config.module.generator.asset;
    }

    // Ne pas bundler ces packages côté serveur
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        '@duckdb/duckdb-wasm',
      ];
    }

    return config;
  },

  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],

  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);