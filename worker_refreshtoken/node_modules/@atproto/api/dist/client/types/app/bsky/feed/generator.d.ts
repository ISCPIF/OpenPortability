/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon';
import * as AppBskyRichtextFacet from '../richtext/facet';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
export interface Record {
    did: string;
    displayName: string;
    description?: string;
    descriptionFacets?: AppBskyRichtextFacet.Main[];
    avatar?: BlobRef;
    /** Declaration that a feed accepts feedback interactions from a client through app.bsky.feed.sendInteractions */
    acceptsInteractions?: boolean;
    labels?: ComAtprotoLabelDefs.SelfLabels | {
        $type: string;
        [k: string]: unknown;
    };
    createdAt: string;
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
//# sourceMappingURL=generator.d.ts.map