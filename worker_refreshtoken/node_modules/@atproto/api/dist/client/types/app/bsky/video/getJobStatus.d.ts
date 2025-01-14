/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyVideoDefs from './defs';
export interface QueryParams {
    jobId: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    jobStatus: AppBskyVideoDefs.JobStatus;
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
//# sourceMappingURL=getJobStatus.d.ts.map