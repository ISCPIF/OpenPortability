/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as ComAtprotoServerDefs from './defs';
export interface QueryParams {
    includeUsed?: boolean;
    /** Controls whether any new 'earned' but not 'created' invites should be created. */
    createAvailable?: boolean;
}
export type InputSchema = undefined;
export interface OutputSchema {
    codes: ComAtprotoServerDefs.InviteCode[];
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
export declare class DuplicateCreateError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getAccountInviteCodes.d.ts.map