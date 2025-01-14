/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface Record {
    /** Reference (AT-URI) to the post record. */
    post: string;
    allow?: (MentionRule | FollowingRule | ListRule | {
        $type: string;
        [k: string]: unknown;
    })[];
    createdAt: string;
    /** List of hidden reply URIs. */
    hiddenReplies?: string[];
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
/** Allow replies from actors mentioned in your post. */
export interface MentionRule {
    [k: string]: unknown;
}
export declare function isMentionRule(v: unknown): v is MentionRule;
export declare function validateMentionRule(v: unknown): ValidationResult;
/** Allow replies from actors you follow. */
export interface FollowingRule {
    [k: string]: unknown;
}
export declare function isFollowingRule(v: unknown): v is FollowingRule;
export declare function validateFollowingRule(v: unknown): ValidationResult;
/** Allow replies from actors on a list. */
export interface ListRule {
    list: string;
    [k: string]: unknown;
}
export declare function isListRule(v: unknown): v is ListRule;
export declare function validateListRule(v: unknown): ValidationResult;
//# sourceMappingURL=threadgate.d.ts.map