/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
}
export interface InputSchema {
    codeCount: number;
    useCount: number;
    forAccounts?: string[];
    [k: string]: unknown;
}
export interface OutputSchema {
    codes: AccountCodes[];
    [k: string]: unknown;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
    qp?: QueryParams;
    encoding?: 'application/json';
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
export interface AccountCodes {
    account: string;
    codes: string[];
    [k: string]: unknown;
}
export declare function isAccountCodes(v: unknown): v is AccountCodes;
export declare function validateAccountCodes(v: unknown): ValidationResult;
//# sourceMappingURL=createInviteCodes.d.ts.map