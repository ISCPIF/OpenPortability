export async function GET() {
  const HOSTNAME = 'app.beta.v2.helloquitx.com';
 
  return Response.json({
    '@context': ['https://www.w3.org/ns/did/v1'],
    'id': `did:web:${HOSTNAME}`,
    'service': [
      {
        'id': '#bsky_oauth',
        'type': 'BskyOAuthProvider',
        'serviceEndpoint': `https://${HOSTNAME}`
      }
    ]
  })
}