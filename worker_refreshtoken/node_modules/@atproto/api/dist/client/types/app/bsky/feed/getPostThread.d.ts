/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as AppBskyFeedDefs from './defs';
export interface QueryParams {
    /** Reference (AT-URI) to post record. */
    uri: string;
    /** How many levels of reply depth should be included in response. */
    depth?: number;
    /** How many levels of parent (and grandparent, etc) post to include. */
    parentHeight?: number;
}
export type InputSchema = undefined;
export interface OutputSchema {
    thread: AppBskyFeedDefs.ThreadViewPost | AppBskyFeedDefs.NotFoundPost | AppBskyFeedDefs.BlockedPost | {
        $type: string;
        [k: string]: unknown;
    };
    threadgate?: AppBskyFeedDefs.ThreadgateView;
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
export declare class NotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getPostThread.d.ts.map