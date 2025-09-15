import { NextRequest, NextResponse } from "next/server";
import { withPublicValidation } from "@/lib/validation/middleware";
import { z } from "zod";

export const GET = withPublicValidation(
  z.object({}).passthrough(),
  async (request: NextRequest) => {
    // Determine base URL from env or request origin
    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;

    const metadata = {
      client_id: `${baseUrl}/client-metadata.json`,
      application_type: "web",
      client_name: "OpenPortability",
      redirect_uris: [
        `${baseUrl}/api/auth/bluesky/callback`
      ],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "atproto transition:generic",
      dpop_bound_access_tokens: true,
      token_endpoint_auth_method: "private_key_jwt",
      jwks_uri: `${baseUrl}/jwks.json`,
      token_endpoint_auth_signing_alg: "ES256",
    };

    return NextResponse.json(metadata, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  },
  {
    validateQueryParams: true,
    queryParamsSchema: z.object({}).passthrough(),
    applySecurityChecks: true,
    customRateLimit: { identifier: 'ip', windowMs: 60_000, maxRequests: 120 },
  }
);
