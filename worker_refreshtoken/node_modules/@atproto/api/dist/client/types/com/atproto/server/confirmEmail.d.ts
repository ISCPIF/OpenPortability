/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export interface QueryParams {
}
export interface InputSchema {
    email: string;
    token: string;
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
}
export declare class AccountNotFoundError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class ExpiredTokenError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidTokenError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidEmailError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=confirmEmail.d.ts.map