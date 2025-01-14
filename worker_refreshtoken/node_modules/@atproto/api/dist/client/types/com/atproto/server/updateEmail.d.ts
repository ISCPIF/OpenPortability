/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export interface QueryParams {
}
export interface InputSchema {
    email: string;
    emailAuthFactor?: boolean;
    /** Requires a token from com.atproto.sever.requestEmailUpdate if the account's email has been confirmed. */
    token?: string;
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
export declare class ExpiredTokenError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidTokenError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class TokenRequiredError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=updateEmail.d.ts.map