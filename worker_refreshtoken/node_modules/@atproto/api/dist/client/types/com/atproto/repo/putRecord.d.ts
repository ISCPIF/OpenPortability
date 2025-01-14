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
    /** Can be set to 'false' to skip Lexicon schema validation of record data, 'true' to require it, or leave unset to validate only for known Lexicons. */
    validate?: boolean;
    /** The record to write. */
    record: {};
    /** Compare and swap with the previous record by CID. WARNING: nullable and optional field; may cause problems with golang implementation */
    swapRecord?: string | null;
    /** Compare and swap with the previous commit by CID. */
    swapCommit?: string;
    [k: string]: unknown;
}
export interface OutputSchema {
    uri: string;
    cid: string;
    commit?: ComAtprotoRepoDefs.CommitMeta;
    validationStatus?: 'valid' | 'unknown' | (string & {});
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
//# sourceMappingURL=putRecord.d.ts.map