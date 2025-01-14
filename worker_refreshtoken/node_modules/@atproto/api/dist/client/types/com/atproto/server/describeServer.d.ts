/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    /** If true, an invite code must be supplied to create an account on this instance. */
    inviteCodeRequired?: boolean;
    /** If true, a phone verification token must be supplied to create an account on this instance. */
    phoneVerificationRequired?: boolean;
    /** List of domain suffixes that can be used in account handles. */
    availableUserDomains: string[];
    links?: Links;
    contact?: Contact;
    did: string;
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
export interface Links {
    privacyPolicy?: string;
    termsOfService?: string;
    [k: string]: unknown;
}
export declare function isLinks(v: unknown): v is Links;
export declare function validateLinks(v: unknown): ValidationResult;
export interface Contact {
    email?: string;
    [k: string]: unknown;
}
export declare function isContact(v: unknown): v is Contact;
export declare function validateContact(v: unknown): ValidationResult;
//# sourceMappingURL=describeServer.d.ts.map