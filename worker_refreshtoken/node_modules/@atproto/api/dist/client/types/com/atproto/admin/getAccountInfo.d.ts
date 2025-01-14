/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ComAtprotoAdminDefs from './defs';
export interface QueryParams {
    did: string;
}
export type InputSchema = undefined;
export type OutputSchema = ComAtprotoAdminDefs.AccountView;
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
//# sourceMappingURL=getAccountInfo.d.ts.map