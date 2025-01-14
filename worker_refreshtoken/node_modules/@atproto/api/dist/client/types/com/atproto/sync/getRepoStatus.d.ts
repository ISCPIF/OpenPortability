/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export interface QueryParams {
    /** The DID of the repo. */
    did: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    did: string;
    active: boolean;
    /** If active=false, this optional field indicates a possible reason for why the account is not active. If active=false and no status is supplied, then the host makes no claim for why the repository is no longer being hosted. */
    status?: 'takendown' | 'suspended' | 'deactivated' | (string & {});
    /** Optional field, the current rev of the repo, if active=true */
    rev?: string;
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
export declare class RepoNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=getRepoStatus.d.ts.map