/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    did: string;
    feeds: Feed[];
    links?: Links;
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
export interface Feed {
    uri: string;
    [k: string]: unknown;
}
export declare function isFeed(v: unknown): v is Feed;
export declare function validateFeed(v: unknown): ValidationResult;
export interface Links {
    privacyPolicy?: string;
    termsOfService?: string;
    [k: string]: unknown;
}
export declare function isLinks(v: unknown): v is Links;
export declare function validateLinks(v: unknown): ValidationResult;
//# sourceMappingURL=describeFeedGenerator.d.ts.map