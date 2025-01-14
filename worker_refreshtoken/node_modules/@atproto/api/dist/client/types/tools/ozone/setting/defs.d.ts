/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface Option {
    key: string;
    did: string;
    value: {};
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    managerRole?: 'tools.ozone.team.defs#roleModerator' | 'tools.ozone.team.defs#roleTriage' | 'tools.ozone.team.defs#roleAdmin' | (string & {});
    scope: 'instance' | 'personal' | (string & {});
    createdBy: string;
    lastUpdatedBy: string;
    [k: string]: unknown;
}
export declare function isOption(v: unknown): v is Option;
export declare function validateOption(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map