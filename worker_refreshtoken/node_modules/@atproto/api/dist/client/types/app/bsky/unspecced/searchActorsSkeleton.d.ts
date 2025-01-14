/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as AppBskyUnspeccedDefs from './defs';
export interface QueryParams {
    /** Search query string; syntax, phrase, boolean, and faceting is unspecified, but Lucene query syntax is recommended. For typeahead search, only simple term match is supported, not full syntax. */
    q: string;
    /** DID of the account making the request (not included for public/unauthenticated queries). Used to boost followed accounts in ranking. */
    viewer?: string;
    /** If true, acts as fast/simple 'typeahead' query. */
    typeahead?: boolean;
    limit?: number;
    /** Optional pagination mechanism; may not necessarily allow scrolling through entire result set. */
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    /** Count of search hits. Optional, may be rounded/truncated, and may not be possible to paginate through all hits. */
    hitsTotal?: number;
    actors: AppBskyUnspeccedDefs.SkeletonSearchActor[];
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
//# sourceMappingURL=searchActorsSkeleton.d.ts.map