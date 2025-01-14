/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ChatBskyConvoDefs from './defs';
export interface QueryParams {
    members: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
    convo: ChatBskyConvoDefs.ConvoView;
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
//# sourceMappingURL=getConvoForMembers.d.ts.map