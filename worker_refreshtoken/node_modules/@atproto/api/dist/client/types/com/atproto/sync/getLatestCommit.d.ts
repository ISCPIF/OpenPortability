/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export interface QueryParams {
    /** The DID of the repo. */
    did: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cid: string;
    rev: string;
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
export declare class RepoNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class RepoTakendownError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class RepoSuspendedError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class RepoDeactivatedError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getLatestCommit.d.ts.map