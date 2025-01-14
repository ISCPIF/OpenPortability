/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
import * as ChatBskyConvoDefs from './defs';
export interface QueryParams {
}
export interface InputSchema {
    items: BatchItem[];
    [k: string]: unknown;
}
export interface OutputSchema {
    items: ChatBskyConvoDefs.MessageView[];
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
export declare function toKnownErr(e: any): any;
export interface BatchItem {
    convoId: string;
    message: ChatBskyConvoDefs.MessageInput;
    [k: string]: unknown;
}
export declare function isBatchItem(v: unknown): v is BatchItem;
export declare function validateBatchItem(v: unknown): ValidationResult;
//# sourceMappingURL=sendMessageBatch.d.ts.map