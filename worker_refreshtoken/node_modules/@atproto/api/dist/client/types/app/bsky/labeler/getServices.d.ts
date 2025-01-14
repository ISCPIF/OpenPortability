/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyLabelerDefs from './defs';
export interface QueryParams {
    dids: string[];
    detailed?: boolean;
}
export type InputSchema = undefined;
export interface OutputSchema {
    views: (AppBskyLabelerDefs.LabelerView | AppBskyLabelerDefs.LabelerViewDetailed | {
        $type: string;
        [k: string]: unknown;
    })[];
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
//# sourceMappingURL=getServices.d.ts.map