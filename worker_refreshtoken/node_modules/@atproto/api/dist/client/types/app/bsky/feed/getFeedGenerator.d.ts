/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyFeedDefs from './defs';
export interface QueryParams {
    /** AT-URI of the feed generator record. */
    feed: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    view: AppBskyFeedDefs.GeneratorView;
    /** Indicates whether the feed generator service has been online recently, or else seems to be inactive. */
    isOnline: boolean;
    /** Indicates whether the feed generator service is compatible with the record declaration. */
    isValid: boolean;
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
//# sourceMappingURL=getFeedGenerator.d.ts.map