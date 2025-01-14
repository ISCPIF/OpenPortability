/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    passwords: AppPassword[];
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
export declare class AccountTakedownError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
export interface AppPassword {
    name: string;
    createdAt: string;
    privileged?: boolean;
    [k: string]: unknown;
}
export declare function isAppPassword(v: unknown): v is AppPassword;
export declare function validateAppPassword(v: unknown): ValidationResult;
//# sourceMappingURL=listAppPasswords.d.ts.map