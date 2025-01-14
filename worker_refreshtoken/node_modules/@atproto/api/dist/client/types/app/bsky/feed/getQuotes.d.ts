/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyFeedDefs from './defs';
export interface QueryParams {
    /** Reference (AT-URI) of post record */
    uri: string;
    /** If supplied, filters to quotes of specific version (by CID) of the post record. */
    cid?: string;
    limit?: number;
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    uri: string;
    cid?: string;
    cursor?: string;
    posts: AppBskyFeedDefs.PostView[];
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
//# sourceMappingURL=getQuotes.d.ts.map