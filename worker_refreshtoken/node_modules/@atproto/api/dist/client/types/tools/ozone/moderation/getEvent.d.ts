/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneModerationDefs from './defs';
export interface QueryParams {
    id: number;
}
export type InputSchema = undefined;
export type OutputSchema = ToolsOzoneModerationDefs.ModEventViewDetail;
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
//# sourceMappingURL=getEvent.d.ts.map