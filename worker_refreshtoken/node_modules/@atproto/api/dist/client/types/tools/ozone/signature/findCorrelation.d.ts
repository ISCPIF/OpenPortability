/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneSignatureDefs from './defs';
export interface QueryParams {
    dids: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
    details: ToolsOzoneSignatureDefs.SigDetail[];
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
//# sourceMappingURL=findCorrelation.d.ts.map