/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as AppBskyUnspeccedDefs from './defs';
export interface QueryParams {
    /** Search query string; syntax, phrase, boolean, and faceting is unspecified, but Lucene query syntax is recommended. */
    q: string;
    /** DID of the account making the request (not included for public/unauthenticated queries). */
    viewer?: string;
    limit?: number;
    /** Optional pagination mechanism; may not necessarily allow scrolling through entire result set. */
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    /** Count of search hits. Optional, may be rounded/truncated, and may not be possible to paginate through all hits. */
    hitsTotal?: number;
    starterPacks: AppBskyUnspeccedDefs.SkeletonSearchStarterPack[];
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
export declare class BadQueryStringError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=searchStarterPacksSkeleton.d.ts.map