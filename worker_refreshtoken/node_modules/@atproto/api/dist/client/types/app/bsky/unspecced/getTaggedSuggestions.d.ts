/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    suggestions: Suggestion[];
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
export interface Suggestion {
    tag: string;
    subjectType: 'actor' | 'feed' | (string & {});
    subject: string;
    [k: string]: unknown;
}
export declare function isSuggestion(v: unknown): v is Suggestion;
export declare function validateSuggestion(v: unknown): ValidationResult;
//# sourceMappingURL=getTaggedSuggestions.d.ts.map