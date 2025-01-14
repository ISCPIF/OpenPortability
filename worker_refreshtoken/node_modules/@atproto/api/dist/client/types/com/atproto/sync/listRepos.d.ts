/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
    limit?: number;
    cursor?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    repos: Repo[];
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
export interface Repo {
    did: string;
    /** Current repo commit CID */
    head: string;
    rev: string;
    active?: boolean;
    /** If active=false, this optional field indicates a possible reason for why the account is not active. If active=false and no status is supplied, then the host makes no claim for why the repository is no longer being hosted. */
    status?: 'takendown' | 'suspended' | 'deactivated' | (string & {});
    [k: string]: unknown;
}
export declare function isRepo(v: unknown): v is Repo;
export declare function validateRepo(v: unknown): ValidationResult;
//# sourceMappingURL=listRepos.d.ts.map