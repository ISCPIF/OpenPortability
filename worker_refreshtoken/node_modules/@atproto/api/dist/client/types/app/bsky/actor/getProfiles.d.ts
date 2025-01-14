/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as AppBskyActorDefs from './defs';
export interface QueryParams {
    actors: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
    profiles: AppBskyActorDefs.ProfileViewDetailed[];
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
//# sourceMappingURL=getProfiles.d.ts.map