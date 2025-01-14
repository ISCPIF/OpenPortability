/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneSetDefs from './defs';
export interface QueryParams {
}
export type InputSchema = ToolsOzoneSetDefs.Set;
export type OutputSchema = ToolsOzoneSetDefs.SetView;
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
    qp?: QueryParams;
    encoding?: 'application/json';
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=upsertSet.d.ts.map