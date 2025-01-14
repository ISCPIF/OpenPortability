/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as ComAtprotoRepoDefs from './defs';
export interface QueryParams {
}
export interface InputSchema {
    /** The handle or DID of the repo (aka, current account). */
    repo: string;
    /** The NSID of the record collection. */
    collection: string;
    /** The Record Key. */
    rkey: string;
    /** Compare and swap with the previous record by CID. */
    swapRecord?: string;
    /** Compare and swap with the previous commit by CID. */
    swapCommit?: string;
    [k: string]: unknown;
}
export interface OutputSchema {
    commit?: ComAtprotoRepoDefs.CommitMeta;
    [k: string]: unknown;
}
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
export declare class InvalidSwapError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=deleteRecord.d.ts.map