/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as ComAtprotoServerDefs from '../server/defs';
export interface StatusAttr {
    applied: boolean;
    ref?: string;
    [k: string]: unknown;
}
export declare function isStatusAttr(v: unknown): v is StatusAttr;
export declare function validateStatusAttr(v: unknown): ValidationResult;
export interface AccountView {
    did: string;
    handle: string;
    email?: string;
    relatedRecords?: {}[];
    indexedAt: string;
    invitedBy?: ComAtprotoServerDefs.InviteCode;
    invites?: ComAtprotoServerDefs.InviteCode[];
    invitesDisabled?: boolean;
    emailConfirmedAt?: string;
    inviteNote?: string;
    deactivatedAt?: string;
    threatSignatures?: ThreatSignature[];
    [k: string]: unknown;
}
export declare function isAccountView(v: unknown): v is AccountView;
export declare function validateAccountView(v: unknown): ValidationResult;
export interface RepoRef {
    did: string;
    [k: string]: unknown;
}
export declare function isRepoRef(v: unknown): v is RepoRef;
export declare function validateRepoRef(v: unknown): ValidationResult;
export interface RepoBlobRef {
    did: string;
    cid: string;
    recordUri?: string;
    [k: string]: unknown;
}
export declare function isRepoBlobRef(v: unknown): v is RepoBlobRef;
export declare function validateRepoBlobRef(v: unknown): ValidationResult;
export interface ThreatSignature {
    property: string;
    value: string;
    [k: string]: unknown;
}
export declare function isThreatSignature(v: unknown): v is ThreatSignature;
export declare function validateThreatSignature(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map