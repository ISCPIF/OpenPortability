/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
export interface QueryParams {
}
export interface InputSchema {
    recipientDid: string;
    content: string;
    subject?: string;
    senderDid: string;
    /** Additional comment by the sender that won't be used in the email itself but helpful to provide more context for moderators/reviewers */
    comment?: string;
    [k: string]: unknown;
}
export interface OutputSchema {
    sent: boolean;
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
//# sourceMappingURL=sendEmail.d.ts.map