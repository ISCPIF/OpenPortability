import { NextRequest, NextResponse } from "next/server";

function toPublicJwk(privateJwk: Record<string, any>) {
  const { d, ...pub } = privateJwk || {};
  return pub;
}

export async function GET(request: NextRequest) {
  const jwkStr = process.env.BLUESKY_PRIVATE_JWK;
  if (!jwkStr) {
    return NextResponse.json({ error: "JWKS not configured" }, { status: 500 });
  }

  try {
    const jwk = JSON.parse(jwkStr);
    const publicJwk = toPublicJwk(jwk);

    // Return as a JWKS set
    return NextResponse.json({ keys: [publicJwk] }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Invalid BLUESKY_PRIVATE_JWK" }, { status: 500 });
  }
}
