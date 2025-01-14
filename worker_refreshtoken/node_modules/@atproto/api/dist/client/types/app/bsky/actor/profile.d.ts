/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef';
export interface Record {
    displayName?: string;
    /** Free-form profile description text. */
    description?: string;
    /** Small image to be displayed next to posts from account. AKA, 'profile picture' */
    avatar?: BlobRef;
    /** Larger horizontal image to display behind profile view. */
    banner?: BlobRef;
    labels?: ComAtprotoLabelDefs.SelfLabels | {
        $type: string;
        [k: string]: unknown;
    };
    joinedViaStarterPack?: ComAtprotoRepoStrongRef.Main;
    pinnedPost?: ComAtprotoRepoStrongRef.Main;
    createdAt?: string;
    [k: string]: unknown;
}
export declare function isRecord(v: unknown): v is Record;
export declare function validateRecord(v: unknown): ValidationResult;
//# sourceMappingURL=profile.d.ts.map