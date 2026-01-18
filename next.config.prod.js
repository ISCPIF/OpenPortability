const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ PRODUCTION: Vérification TypeScript activée
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com', 'cdn.bsky.app'],
  },

  // Désactive le header X-Powered-By pour la sécurité
  poweredByHeader: false,

  // Active la compression gzip
  compress: true,

  // Transpile embedding-atlas to avoid minification issues with its toolbar
  transpilePackages: ['embedding-atlas'],

  // Désactiver le minifier SWC pour permettre à Webpack/Terser de gérer la minification
  swcMinify: false,

  experimental: {
    // Enable instrumentation hook for pg-notify listener startup
    instrumentationHook: true,
    
    staleTimes: {
      dynamic: 30,  // 30 secondes pour les pages dynamiques
      static: 300,  // 5 minutes pour les pages statiques
    },
    optimizePackageImports: ['lucide-react', '@heroicons/react', 'react-icons'],
  },

  // ✅ Webpack config pour production (embedding-atlas + duckdb)
  webpack: (config, { isServer }) => {
    // Fix pour embedding-atlas: résout le conflit avec asset/inline modules
    // https://github.com/vercel/next.js/discussions/36981
    if (config.module.generator) {
      config.module.generator['asset/resource'] = config.module.generator.asset;
      config.module.generator['asset/source'] = config.module.generator.asset;
      delete config.module.generator.asset;
    }

    // Fix pour embedding-atlas: isoler dans son propre chunk chargé dynamiquement
    // et exclure ce module spécifique de la minification via Terser.
    // https://github.com/vercel/next.js/issues/59594
    if (!isServer) {
      const TerserPlugin = require('terser-webpack-plugin');

      // Forcer embedding-atlas dans son propre chunk pour le lazy loading
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          embeddingAtlas: {
            test: /[\\/]node_modules[\\/]embedding-atlas[\\/]/,
            name: 'embedding-atlas',
            chunks: 'async', // uniquement pour les imports dynamiques
            priority: 50,
            enforce: true,
          },
        },
      };

      // Utiliser Terser et exclure embedding-atlas de la minification
      config.optimization.minimizer = [
        new TerserPlugin({
          exclude: /[\\/]node_modules[\\/]embedding-atlas[\\/]/,
          terserOptions: {
            compress: true,
            mangle: true,
          },
        }),
      ];
    }

    // Ignore les warnings de duckdb-wasm
    config.ignoreWarnings = [
      { module: /@duckdb\/duckdb-wasm/ },
    ];

    // Ne pas bundler ces packages côté serveur
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        '@duckdb/duckdb-wasm',
      ];
    }

    return config;
  },

  // Headers de sécurité
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

  // Rewrites pour les favicons avec préfixe locale (évite 404 sur /fr/favicon.svg)
  rewrites: async () => [
    { source: '/:locale/favicon.svg', destination: '/favicon.svg' },
    { source: '/:locale/favicon.ico', destination: '/favicon.ico' },
  ],

  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);
