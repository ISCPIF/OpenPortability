/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export interface QueryParams {
    /** The DID of the account. */
    did: string;
    /** The CID of the blob to fetch */
    cid: string;
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
export declare class BlobNotFoundError extends XRPCError {
    constructor(src: XRPCError);
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
//# sourceMappingURL=getBlob.d.ts.map