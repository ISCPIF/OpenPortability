/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as AppBskyRichtextFacet from '../richtext/facet';
export interface Record {
    /** Display name for starter pack; can not be empty. */
    name: string;
    description?: string;
    descriptionFacets?: AppBskyRichtextFacet.Main[];
    /** Reference (AT-URI) to the list record. */
    list: string;
    feeds?: FeedItem[];
    createdAt: string;
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
export interface FeedItem {
    uri: string;
    [k: string]: unknown;
}
export declare function isFeedItem(v: unknown): v is FeedItem;
export declare function validateFeedItem(v: unknown): ValidationResult;
//# sourceMappingURL=starterpack.d.ts.map