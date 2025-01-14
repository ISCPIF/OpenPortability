/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    activated: boolean;
    validDid: boolean;
    repoCommit: string;
    repoRev: string;
    repoBlocks: number;
    indexedRecords: number;
    privateStateValues: number;
    expectedBlobs: number;
    importedBlobs: number;
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
//# sourceMappingURL=checkAccountStatus.d.ts.map