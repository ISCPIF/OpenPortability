import { encode as base64url } from 'base64url';
import { webcrypto } from 'node:crypto';

export interface DPoPHeader {
  typ: "dpop+jwt";
  alg: "ES256";
  jwk: JsonWebKey & {
    alg?: string;
    use?: string;
    kid?: string;
  };
}

export interface DPoPClaims {
  jti: string;
  htm: string;
  htu: string;
  iat: number;
  exp?: number;
  nonce?: string;
  ath?: string;
  iss?: string;
}

export interface DPoPProofParams {
  htm: string;
  htu: string;
  ath?: string;
  nonce?: string;
  iss?: string;
}

const getCrypto = () => {
  return typeof window !== 'undefined' ? window.crypto : webcrypto;
};

export async function generateDPoPKeyPair() {
  const crypto = getCrypto();
  return crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );
}

export async function createDpopToken(
  header: DPoPHeader,
  claims: DPoPClaims,
  privateKey: CryptoKey
): Promise<string> {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaims = base64url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const signature = await getCrypto().subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" }
    },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

export async function createDpopProof(
  params: DPoPProofParams,
  keyPair: CryptoKeyPair
): Promise<string> {
  const crypto = getCrypto();
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  
  // Add required JWK parameters
  publicKeyJwk.alg = "ES256";
  publicKeyJwk.use = "sig";
  publicKeyJwk.kid = crypto.randomUUID(); // Add a key ID
  
  const header: DPoPHeader = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: publicKeyJwk,
  };

  const now = Math.floor(Date.now() / 1000);
  const claims: DPoPClaims = {
    jti: crypto.randomUUID(),
    htm: params.htm,
    htu: params.htu,
    iat: now,
    exp: now + 120 // 2 minutes expiration
  };

  if (params.nonce) {
    claims.nonce = params.nonce;
  }

  if (params.ath) {
    const athBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(params.ath)
    );
    claims.ath = base64url(new Uint8Array(athBuffer));
  }

  if (params.iss) {
    claims.iss = params.iss;
  }

  return createDpopToken(header, claims, keyPair.privateKey);
}

export function needsNewNonce(response: Response): boolean {
  const authHeader = response.headers.get('WWW-Authenticate');
  return authHeader?.toLowerCase().includes('error="use_dpop_nonce"') ?? false;
}

export function extractNonce(response: Response): string | null {
  const nonce = response.headers.get('DPoP-Nonce');
  if (nonce) return nonce;
  
  const authHeader = response.headers.get('WWW-Authenticate');
  if (!authHeader) return null;
  
  const match = authHeader.match(/nonce="([^"]+)"/);
  return match ? match[1] : null;
}