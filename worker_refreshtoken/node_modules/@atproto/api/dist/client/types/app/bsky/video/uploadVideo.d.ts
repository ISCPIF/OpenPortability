/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyVideoDefs from './defs';
export interface QueryParams {
}
export type InputSchema = string | Uint8Array | Blob;
export interface OutputSchema {
    jobStatus: AppBskyVideoDefs.JobStatus;
    [k: string]: unknown;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
    qp?: QueryParams;
    encoding?: 'video/mp4';
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=uploadVideo.d.ts.map