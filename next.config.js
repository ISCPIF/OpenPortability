/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ Dangereux: Ignore les erreurs TypeScript pendant la production build
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com', 'cdn.bsky.app', 'mastodon.social']
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

module.exports = nextConfig