/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export interface QueryParams {
}
export interface InputSchema {
    /** A token received through com.atproto.identity.requestPlcOperationSignature */
    token?: string;
    rotationKeys?: string[];
    alsoKnownAs?: string[];
    verificationMethods?: {};
    services?: {};
    [k: string]: unknown;
}
export interface OutputSchema {
    /** A signed DID PLC operation. */
    operation: {};
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
//# sourceMappingURL=signPlcOperation.d.ts.map