/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
    limit?: number;
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    blobs: RecordBlob[];
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
export interface RecordBlob {
    cid: string;
    recordUri: string;
    [k: string]: unknown;
}
export declare function isRecordBlob(v: unknown): v is RecordBlob;
export declare function validateRecordBlob(v: unknown): ValidationResult;
//# sourceMappingURL=listMissingBlobs.d.ts.map