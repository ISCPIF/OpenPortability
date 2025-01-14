/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ChatBskyConvoDefs from './defs';
export interface QueryParams {
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    logs: (ChatBskyConvoDefs.LogBeginConvo | ChatBskyConvoDefs.LogLeaveConvo | ChatBskyConvoDefs.LogCreateMessage | ChatBskyConvoDefs.LogDeleteMessage | {
        $type: string;
        [k: string]: unknown;
    })[];
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
//# sourceMappingURL=getLog.d.ts.map