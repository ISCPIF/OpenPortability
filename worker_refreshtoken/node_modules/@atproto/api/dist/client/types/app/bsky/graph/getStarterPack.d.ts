/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyGraphDefs from './defs';
export interface QueryParams {
    /** Reference (AT-URI) of the starter pack record. */
    starterPack: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    starterPack: AppBskyGraphDefs.StarterPackView;
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
//# sourceMappingURL=getStarterPack.d.ts.map