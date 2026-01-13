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

  experimental: {
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

    // Fix pour embedding-atlas: désactiver la minification côté client
    // La minification/mangling de SWC casse les boutons lasso/sélection de la toolbar
    // Car embedding-atlas utilise des noms de classes/fonctions en interne
    // Next.js ne supporte pas l'exclusion de modules spécifiques de la minification
    // Impact: bundle ~1.3-1.5x plus gros après gzip (acceptable pour cette app)
    // https://github.com/vercel/next.js/issues/59594
    // https://github.com/vercel/next.js/discussions/39160
    if (!isServer) {
      config.optimization.minimize = false;
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

  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);
