/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
import * as ComAtprotoRepoDefs from './defs';
export interface QueryParams {
}
export interface InputSchema {
    /** The handle or DID of the repo (aka, current account). */
    repo: string;
    /** Can be set to 'false' to skip Lexicon schema validation of record data across all operations, 'true' to require it, or leave unset to validate only for known Lexicons. */
    validate?: boolean;
    writes: (Create | Update | Delete)[];
    /** If provided, the entire operation will fail if the current repo commit CID does not match this value. Used to prevent conflicting repo mutations. */
    swapCommit?: string;
    [k: string]: unknown;
}
export interface OutputSchema {
    commit?: ComAtprotoRepoDefs.CommitMeta;
    results?: (CreateResult | UpdateResult | DeleteResult)[];
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
/** Operation which creates a new record. */
export interface Create {
    collection: string;
    rkey?: string;
    value: {};
    [k: string]: unknown;
}
export declare function isCreate(v: unknown): v is Create;
export declare function validateCreate(v: unknown): ValidationResult;
/** Operation which updates an existing record. */
export interface Update {
    collection: string;
    rkey: string;
    value: {};
    [k: string]: unknown;
}
export declare function isUpdate(v: unknown): v is Update;
export declare function validateUpdate(v: unknown): ValidationResult;
/** Operation which deletes an existing record. */
export interface Delete {
    collection: string;
    rkey: string;
    [k: string]: unknown;
}
export declare function isDelete(v: unknown): v is Delete;
export declare function validateDelete(v: unknown): ValidationResult;
export interface CreateResult {
    uri: string;
    cid: string;
    validationStatus?: 'valid' | 'unknown' | (string & {});
    [k: string]: unknown;
}
export declare function isCreateResult(v: unknown): v is CreateResult;
export declare function validateCreateResult(v: unknown): ValidationResult;
export interface UpdateResult {
    uri: string;
    cid: string;
    validationStatus?: 'valid' | 'unknown' | (string & {});
    [k: string]: unknown;
}
export declare function isUpdateResult(v: unknown): v is UpdateResult;
export declare function validateUpdateResult(v: unknown): ValidationResult;
export interface DeleteResult {
    [k: string]: unknown;
}
export declare function isDeleteResult(v: unknown): v is DeleteResult;
export declare function validateDeleteResult(v: unknown): ValidationResult;
//# sourceMappingURL=applyWrites.d.ts.map