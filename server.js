const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

console.log('Starting server with config:', {
  dev,
  hostname,
  port,
  NODE_ENV: process.env.NODE_ENV,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_URL_INTERNAL: process.env.NEXTAUTH_URL_INTERNAL
})

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Intercepter les requêtes de Next.js
const originalGetRequestHandler = app.getRequestHandler
app.getRequestHandler = () => {
  const handler = originalGetRequestHandler.call(app)
  return async (req, res, parsedUrl) => {
    // Intercepter les redirections
    const originalRedirect = res.redirect
    res.redirect = function(statusOrUrl, url) {
      const redirectUrl = url || statusOrUrl
      console.log(`[${new Date().toISOString()}] Intercepted redirect:`, {
        from: req.url,
        to: redirectUrl,
        status: typeof statusOrUrl === 'number' ? statusOrUrl : 302
      })
      return originalRedirect.apply(this, arguments)
    }
    return handler(req, res, parsedUrl)
  }
}

app.prepare().then(() => {
  createServer({
    maxHeaderSize: 81920, // 80KB
    keepAliveTimeout: 620000, // Augmenter le timeout
    headersTimeout: 621000, // Doit être plus grand que keepAliveTimeout
  }, async (req, res) => {
    try {
      // Parse l'URL
      const parsedUrl = parse(req.url, true)
      
      console.log(`[${new Date().toISOString()}] Incoming request:`, {
        method: req.method,
        url: req.url,
        parsedUrl: {
          pathname: parsedUrl.pathname,
          query: parsedUrl.query
        },
        headers: {
          host: req.headers.host,
          referer: req.headers.referer,
          'user-agent': req.headers['user-agent'],
          cookie: req.headers.cookie ? 'Present' : 'None',
          'x-forwarded-proto': req.headers['x-forwarded-proto'],
          'x-forwarded-host': req.headers['x-forwarded-host']
        }
      })
      
      // Ajouter des en-têtes de sécurité
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Frame-Options', 'DENY')
      res.setHeader('X-XSS-Protection', '1; mode=block')
      
      // Intercepter la réponse pour logger le statut
      const originalEnd = res.end
      const originalWriteHead = res.writeHead
      
      res.writeHead = function(statusCode, headers) {
        console.log(`[${new Date().toISOString()}] Response status:`, statusCode, 'for URL:', req.url)
        if (headers) {
          console.log('Response headers:', headers)
        }
        return originalWriteHead.apply(this, arguments)
      }
      
      res.end = function(chunk, encoding) {
        console.log(`[${new Date().toISOString()}] Request completed:`, {
          url: req.url,
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          hasBody: !!chunk
        })
        return originalEnd.apply(this, arguments)
      }
      
      // Gérer la requête
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error occurred handling ${req.url}:`, {
        error: err.message,
        stack: err.stack,
        headers: req.headers
      })
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  }).listen(port, (err) => {
    if (err) {
      console.error('Failed to start server:', err)
      throw err
    }
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})