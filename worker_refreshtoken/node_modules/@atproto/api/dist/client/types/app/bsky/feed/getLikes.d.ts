/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
import * as AppBskyActorDefs from '../actor/defs';
export interface QueryParams {
    /** AT-URI of the subject (eg, a post record). */
    uri: string;
    /** CID of the subject record (aka, specific version of record), to filter likes. */
    cid?: string;
    limit?: number;
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    uri: string;
    cid?: string;
    cursor?: string;
    likes: Like[];
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
export interface Like {
    indexedAt: string;
    createdAt: string;
    actor: AppBskyActorDefs.ProfileView;
    [k: string]: unknown;
}
export declare function isLike(v: unknown): v is Like;
export declare function validateLike(v: unknown): ValidationResult;
//# sourceMappingURL=getLikes.d.ts.map