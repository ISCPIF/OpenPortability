/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { BlobRef } from '@atproto/lexicon';
export interface QueryParams {
}
export type InputSchema = string | Uint8Array | Blob;
export interface OutputSchema {
    blob: BlobRef;
    [k: string]: unknown;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
    qp?: QueryParams;
    encoding?: string;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=uploadBlob.d.ts.map