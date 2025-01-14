/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyFeedDefs from '../feed/defs';
export interface QueryParams {
    limit?: number;
    cursor?: string;
    query?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    feeds: AppBskyFeedDefs.GeneratorView[];
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
//# sourceMappingURL=getPopularFeedGenerators.d.ts.map