/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
    actor: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    day: Metadata;
    month: Metadata;
    all: Metadata;
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
export interface Metadata {
    messagesSent: number;
    messagesReceived: number;
    convos: number;
    convosStarted: number;
    [k: string]: unknown;
}
export declare function isMetadata(v: unknown): v is Metadata;
export declare function validateMetadata(v: unknown): ValidationResult;
//# sourceMappingURL=getActorMetadata.d.ts.map