/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ComAtprotoAdminDefs from './defs';
export interface QueryParams {
    dids: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
    infos: ComAtprotoAdminDefs.AccountView[];
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
//# sourceMappingURL=getAccountInfos.d.ts.map