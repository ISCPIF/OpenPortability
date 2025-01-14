/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface Record {
    allowIncoming: 'all' | 'none' | 'following' | (string & {});
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
//# sourceMappingURL=declaration.d.ts.map