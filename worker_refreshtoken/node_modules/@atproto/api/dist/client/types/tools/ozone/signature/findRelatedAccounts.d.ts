/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs';
import * as ToolsOzoneSignatureDefs from './defs';
export interface QueryParams {
    did: string;
    cursor?: string;
    limit?: number;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    accounts: RelatedAccount[];
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
export interface RelatedAccount {
    account: ComAtprotoAdminDefs.AccountView;
    similarities?: ToolsOzoneSignatureDefs.SigDetail[];
    [k: string]: unknown;
}
export declare function isRelatedAccount(v: unknown): v is RelatedAccount;
export declare function validateRelatedAccount(v: unknown): ValidationResult;
//# sourceMappingURL=findRelatedAccounts.d.ts.map