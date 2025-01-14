/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
/** width:height represents an aspect ratio. It may be approximate, and may not correspond to absolute dimensions in any given unit. */
export interface AspectRatio {
    width: number;
    height: number;
    [k: string]: unknown;
}
export declare function isAspectRatio(v: unknown): v is AspectRatio;
export declare function validateAspectRatio(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map