/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ComAtprotoLabelDefs from '../label/defs';
export interface QueryParams {
    since?: number;
    limit?: number;
}
export type InputSchema = undefined;
export interface OutputSchema {
    labels: ComAtprotoLabelDefs.Label[];
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
//# sourceMappingURL=fetchLabels.d.ts.map