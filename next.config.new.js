const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts');


/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ Dangereux: Ignore les erreurs TypeScript pendant la production build
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com', 'cdn.bsky.app']
  },
  
  // 🚀 OPTIMISATIONS DE CACHE ET PERFORMANCES POUR LE DÉVELOPPEMENT
  experimental: {
    // Cache les réponses fetch dans les Server Components pendant le HMR
    serverComponentsHmrCache: true,
    
    // Configuration des temps de cache pour le router
    staleTimes: {
      dynamic: 30,  // 30 secondes pour les pages dynamiques
      static: 300,  // 5 minutes pour les pages statiques
    },
    
    // Optimise les imports de packages pour de meilleures performances
    optimizePackageImports: ['lucide-react', '@heroicons/react', 'react-icons'],
  },
  
  // Nouvelle configuration Turbopack (remplace experimental.turbo)
  ...(process.env.NODE_ENV === 'development' && {
    turbopack: {
      resolveAlias: {
        // Évite les résolutions multiples
        'react': 'react',
        'react-dom': 'react-dom'
      }
    }
  }),

  // Webpack config - s'applique en dev ET en production
  webpack: (config, { dev, isServer }) => {
    // FIX pour embedding-atlas: résout le conflit avec asset/inline modules
    if (config.module.generator && config.module.generator.asset) {
      config.module.generator['asset/resource'] = config.module.generator['asset'];
      config.module.generator['asset/source'] = config.module.generator['asset'];
      delete config.module.generator['asset'];
    }

    // Ignorer les warnings de duckdb-wasm (dev + build)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /@duckdb\/duckdb-wasm/ },
    ];

    // Ne pas bundler duckdb-wasm côté serveur (évite les erreurs de build)
    if (isServer) {
      config.externals = [...(config.externals || []), '@duckdb/duckdb-wasm'];
    }

    // Optimisations spécifiques au développement Docker
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
      
      config.resolve.symlinks = false;
      config.resolve.cacheWithContext = false;
    }
    
    return config;
  },

  // Optimisations spécifiques pour Docker + développement
  ...(process.env.NODE_ENV === 'development' && {
    // Active les logs pour diagnostiquer les lenteurs
    logging: {
      fetches: {
        fullUrl: true,
      },
    },
    
    // Optimise la gestion mémoire en développement
    onDemandEntries: {
      // Réduit le temps de garde des pages en mémoire
      maxInactiveAge: 25 * 1000, // 25 secondes au lieu de 60
      // Réduit le nombre de pages gardées en mémoire
      pagesBufferLength: 2, // 2 pages au lieu de 5
    },
  }),
  
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload'
        },
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on'
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block'
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Referrer-Policy',
          value: 'origin-when-cross-origin'
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()'
        }
      ]
    }
  ],
  output: 'standalone',
};


module.exports = withNextIntl(nextConfig);
