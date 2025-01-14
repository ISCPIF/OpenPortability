/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon';
import * as AppBskyGraphDefs from './defs';
import * as AppBskyRichtextFacet from '../richtext/facet';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
export interface Record {
    purpose: AppBskyGraphDefs.ListPurpose;
    /** Display name for list; can not be empty. */
    name: string;
    description?: string;
    descriptionFacets?: AppBskyRichtextFacet.Main[];
    avatar?: BlobRef;
    labels?: ComAtprotoLabelDefs.SelfLabels | {
        $type: string;
        [k: string]: unknown;
    };
    createdAt: string;
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
//# sourceMappingURL=list.d.ts.map