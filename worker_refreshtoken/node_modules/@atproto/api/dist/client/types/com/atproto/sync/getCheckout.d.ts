/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export interface QueryParams {
    /** The DID of the repo. */
    did: string;
}
export type InputSchema = undefined;
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: Uint8Array;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getCheckout.d.ts.map