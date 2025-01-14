/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
    /** The handle or DID of the repo. */
    repo: string;
    /** The NSID of the record type. */
    collection: string;
    /** The number of records to return. */
    limit?: number;
    cursor?: string;
    /** DEPRECATED: The lowest sort-ordered rkey to start from (exclusive) */
    rkeyStart?: string;
    /** DEPRECATED: The highest sort-ordered rkey to stop at (exclusive) */
    rkeyEnd?: string;
    /** Flag to reverse the order of the returned records. */
    reverse?: boolean;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    records: Record[];
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
export interface Record {
    uri: string;
    cid: string;
    value: {};
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
//# sourceMappingURL=listRecords.d.ts.map