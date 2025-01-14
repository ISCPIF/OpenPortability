/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyFeedDefs from './defs';
export interface QueryParams {
    feeds: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
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
//# sourceMappingURL=getFeedGenerators.d.ts.map