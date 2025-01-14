/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export interface QueryParams {
}
export interface InputSchema {
    /** Hostname of the current service (usually a PDS) that is notifying of update. */
    hostname: string;
    [k: string]: unknown;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
    qp?: QueryParams;
    encoding?: 'application/json';
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=notifyOfUpdate.d.ts.map