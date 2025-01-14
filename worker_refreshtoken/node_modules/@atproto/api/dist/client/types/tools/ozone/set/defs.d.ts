/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface Set {
    name: string;
    description?: string;
    [k: string]: unknown;
}
export declare function isSet(v: unknown): v is Set;
export declare function validateSet(v: unknown): ValidationResult;
export interface SetView {
    name: string;
    description?: string;
    setSize: number;
    createdAt: string;
    updatedAt: string;
    [k: string]: unknown;
}
export declare function isSetView(v: unknown): v is SetView;
export declare function validateSetView(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map