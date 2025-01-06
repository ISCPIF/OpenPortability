const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ Dangereux: Ignore les erreurs TypeScript pendant la production build
    ignoreBuildErrors: true,
  },
  images: {
    // TODO: ça va être embetant à générer automatiquement, peut-être qu’il faudra se contenter d’une image
    // statique pour Masto
    domains: ['pbs.twimg.com', 'abs.twimg.com', 'cdn.bsky.app', 'mastodon.social', 'piaille.fr', 'cdn.masto.host']
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ]
  },
  output: 'standalone'
}

module.exports = withNextIntl({
  ...nextConfig,
  generateEtags: false,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-store, must-revalidate'
        }
      ]
    }
  ]
});
