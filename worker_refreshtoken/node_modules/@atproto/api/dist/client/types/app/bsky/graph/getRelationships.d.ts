/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as AppBskyGraphDefs from './defs';
export interface QueryParams {
    /** Primary account requesting relationships for. */
    actor: string;
    /** List of 'other' accounts to be related back to the primary. */
    others?: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
    actor?: string;
    relationships: (AppBskyGraphDefs.Relationship | AppBskyGraphDefs.NotFoundActor | {
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
export declare class ActorNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getRelationships.d.ts.map