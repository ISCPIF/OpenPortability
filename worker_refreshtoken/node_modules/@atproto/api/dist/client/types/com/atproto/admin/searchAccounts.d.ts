/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ComAtprotoAdminDefs from './defs';
export interface QueryParams {
    email?: string;
    cursor?: string;
    limit?: number;
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    accounts: ComAtprotoAdminDefs.AccountView[];
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
//# sourceMappingURL=searchAccounts.d.ts.map