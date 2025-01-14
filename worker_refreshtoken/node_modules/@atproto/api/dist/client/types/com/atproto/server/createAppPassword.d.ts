/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
}
export interface InputSchema {
    /** A short name for the App Password, to help distinguish them. */
    name: string;
    /** If an app password has 'privileged' access to possibly sensitive account state. Meant for use with trusted clients. */
    privileged?: boolean;
    [k: string]: unknown;
}
export type OutputSchema = AppPassword;
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
export declare class AccountTakedownError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
export interface AppPassword {
    name: string;
    password: string;
    createdAt: string;
    privileged?: boolean;
    [k: string]: unknown;
}
export declare function isAppPassword(v: unknown): v is AppPassword;
export declare function validateAppPassword(v: unknown): ValidationResult;
//# sourceMappingURL=createAppPassword.d.ts.map