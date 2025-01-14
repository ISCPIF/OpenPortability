/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as AppBskyLabelerDefs from './defs';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
export interface Record {
    policies: AppBskyLabelerDefs.LabelerPolicies;
    labels?: ComAtprotoLabelDefs.SelfLabels | {
        $type: string;
        [k: string]: unknown;
    };
    createdAt: string;
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
//# sourceMappingURL=service.d.ts.map