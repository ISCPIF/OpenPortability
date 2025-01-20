export async function GET() {
  const HOSTNAME = 'app.beta.v2.helloquitx.com';
  const baseUrl = `https://${HOSTNAME}`;

  return Response.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    pushed_authorization_request_endpoint: `${baseUrl}/oauth/par`,
    scopes_supported: "atproto",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    dpop_signing_alg_values_supported: ["ES256"],
    authorization_response_iss_parameter_supported: true,
    service_documentation: "https://atproto.com/specs/oauth",
    subject_types_supported: ["public"],
    require_pushed_authorization_requests: true,
    dpop_bound_access_tokens: true
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}