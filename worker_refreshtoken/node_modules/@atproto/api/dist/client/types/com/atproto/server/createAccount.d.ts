/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
export interface QueryParams {
}
export interface InputSchema {
    email?: string;
    /** Requested handle for the account. */
    handle: string;
    /** Pre-existing atproto DID, being imported to a new account. */
    did?: string;
    inviteCode?: string;
    verificationCode?: string;
    verificationPhone?: string;
    /** Initial account password. May need to meet instance-specific password strength requirements. */
    password?: string;
    /** DID PLC rotation key (aka, recovery key) to be included in PLC creation operation. */
    recoveryKey?: string;
    /** A signed DID PLC operation to be submitted as part of importing an existing account to this instance. NOTE: this optional field may be updated when full account migration is implemented. */
    plcOp?: {};
    [k: string]: unknown;
}
/** Account login session returned on successful account creation. */
export interface OutputSchema {
    accessJwt: string;
    refreshJwt: string;
    handle: string;
    /** The DID of the new account. */
    did: string;
    /** Complete DID document. */
    didDoc?: {};
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
export declare class InvalidHandleError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidPasswordError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class InvalidInviteCodeError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class HandleNotAvailableError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class UnsupportedDomainError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class UnresolvableDidError extends XRPCError {
    constructor(src: XRPCError);
}
export declare class IncompatibleDidDocError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=createAccount.d.ts.map