/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyActorDefs from './defs';
export interface QueryParams {
    /** Handle or DID of account to fetch profile of. */
    actor: string;
}
export type InputSchema = undefined;
export type OutputSchema = AppBskyActorDefs.ProfileViewDetailed;
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
//# sourceMappingURL=getProfile.d.ts.map