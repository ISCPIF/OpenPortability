export async function GET() {
  const HOSTNAME = 'app.beta.v2.helloquitx.com';
  const baseUrl = `https://${HOSTNAME}`;

  return Response.json({
    resource: baseUrl,
    authorization_servers: [baseUrl]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}