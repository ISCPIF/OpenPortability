/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as ToolsOzoneModerationDefs from './defs';
export interface QueryParams {
    uri: string;
    cid?: string;
}
export type InputSchema = undefined;
export type OutputSchema = ToolsOzoneModerationDefs.RecordViewDetail;
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare class RecordNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getRecord.d.ts.map