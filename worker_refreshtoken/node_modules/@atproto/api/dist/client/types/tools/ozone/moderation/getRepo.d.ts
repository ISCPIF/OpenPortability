/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as ToolsOzoneModerationDefs from './defs';
export interface QueryParams {
    did: string;
}
export type InputSchema = undefined;
export type OutputSchema = ToolsOzoneModerationDefs.RepoViewDetail;
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare class RepoNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getRepo.d.ts.map