/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface Record {
    /** The account which is included on the list. */
    subject: string;
    /** Reference (AT-URI) to the list record (app.bsky.graph.list). */
    list: string;
    createdAt: string;
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
//# sourceMappingURL=listitem.d.ts.map