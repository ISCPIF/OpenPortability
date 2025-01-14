/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export interface QueryParams {
    /** The DID of the repo. */
    did: string;
    /** The revision ('rev') of the repo to create a diff from. */
    since?: string;
}
export type InputSchema = undefined;
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: Uint8Array;
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
//# sourceMappingURL=getRepo.d.ts.map