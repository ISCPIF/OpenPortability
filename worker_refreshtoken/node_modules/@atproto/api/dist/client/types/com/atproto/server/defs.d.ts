/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface InviteCode {
    code: string;
    available: number;
    disabled: boolean;
    forAccount: string;
    createdBy: string;
    createdAt: string;
    uses: InviteCodeUse[];
    [k: string]: unknown;
}
export declare function isInviteCode(v: unknown): v is InviteCode;
export declare function validateInviteCode(v: unknown): ValidationResult;
export interface InviteCodeUse {
    usedBy: string;
    usedAt: string;
    [k: string]: unknown;
}
export declare function isInviteCodeUse(v: unknown): v is InviteCodeUse;
export declare function validateInviteCodeUse(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map