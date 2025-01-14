/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    /** Recommended rotation keys for PLC dids. Should be undefined (or ignored) for did:webs. */
    rotationKeys?: string[];
    alsoKnownAs?: string[];
    verificationMethods?: {};
    services?: {};
    [k: string]: unknown;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getRecommendedDidCredentials.d.ts.map