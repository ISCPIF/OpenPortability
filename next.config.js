const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ On garde la sécurité TypeScript en prod
  typescript: {
    // ⚠️ Dangereux: Ignore les erreurs TypeScript pendant la production build
    ignoreBuildErrors: false,
  },

  // ✅ Domaines autorisés pour les images
  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com', 'cdn.bsky.app'],
  },

  // ✅ Options classiques de prod
  poweredByHeader: false, // Enlève le header X-Powered-By
  compress: true,         // Active gzip/brotli côté Next (si pas déjà géré par le reverse proxy)

  // 🚀 OPTIMISATIONS DE CACHE ET PERFORMANCES
  experimental: {
    // Pas de serverComponentsHmrCache en prod (uniquement utile avec HMR)

    // Configuration des temps de cache pour le router
    staleTimes: {
      dynamic: 30,  // 30 secondes pour les pages dynamiques
      static: 300,  // 5 minutes pour les pages statiques
    },

    // Optimise les imports de packages pour de meilleures performances
    optimizePackageImports: ['lucide-react', '@heroicons/react', 'react-icons'],
  },

  // ✅ Pas de Turbopack/webpack spécifique ici, ton image de prod ne regarde pas le système de fichiers comme en dev

  // ✅ Headers de sécurité adaptés à une prod self‑hosted
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ],

  // ✅ Recommandé pour Docker / déploiements self‑hosted
  output: 'standalone',
};

module.exports = withNextIntl(nextConfig);