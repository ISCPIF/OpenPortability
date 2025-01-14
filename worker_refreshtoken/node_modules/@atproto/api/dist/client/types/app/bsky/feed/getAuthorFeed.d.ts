/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as AppBskyFeedDefs from './defs';
export interface QueryParams {
    actor: string;
    limit?: number;
    cursor?: string;
    /** Combinations of post/repost types to include in response. */
    filter?: 'posts_with_replies' | 'posts_no_replies' | 'posts_with_media' | 'posts_and_author_threads' | (string & {});
    includePins?: boolean;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    feed: AppBskyFeedDefs.FeedViewPost[];
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
export declare class BlockedActorError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class BlockedByActorError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getAuthorFeed.d.ts.map