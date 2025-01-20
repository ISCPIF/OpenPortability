export interface DPoPHeader {
    typ: "dpop+jwt";  // Type littéral
    alg: "ES256";     // Type littéral
    jwk: JsonWebKey;
  }
  
  export interface DPoPClaims {
    jti: string;
    htm: string;
    htu: string;
    iat: number;
    exp?: number;
    nonce?: string;
    ath?: string;
  }
  