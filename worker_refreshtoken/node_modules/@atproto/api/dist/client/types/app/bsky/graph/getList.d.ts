/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyGraphDefs from './defs';
export interface QueryParams {
    /** Reference (AT-URI) of the list record to hydrate. */
    list: string;
    limit?: number;
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    list: AppBskyGraphDefs.ListView;
    items: AppBskyGraphDefs.ListItemView[];
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
//# sourceMappingURL=getList.d.ts.map