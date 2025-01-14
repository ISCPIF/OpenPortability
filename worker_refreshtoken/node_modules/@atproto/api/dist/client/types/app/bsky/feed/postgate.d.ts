/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface Record {
    createdAt: string;
    /** Reference (AT-URI) to the post record. */
    post: string;
    /** List of AT-URIs embedding this post that the author has detached from. */
    detachedEmbeddingUris?: string[];
    embeddingRules?: (DisableRule | {
        $type: string;
        [k: string]: unknown;
    })[];
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
/** Disables embedding of this post. */
export interface DisableRule {
    [k: string]: unknown;
}
export declare function isDisableRule(v: unknown): v is DisableRule;
export declare function validateDisableRule(v: unknown): ValidationResult;
//# sourceMappingURL=postgate.d.ts.map