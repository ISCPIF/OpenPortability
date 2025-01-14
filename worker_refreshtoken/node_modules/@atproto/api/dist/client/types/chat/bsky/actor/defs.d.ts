/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as AppBskyActorDefs from '../../../app/bsky/actor/defs';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
export interface ProfileViewBasic {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    associated?: AppBskyActorDefs.ProfileAssociated;
    viewer?: AppBskyActorDefs.ViewerState;
    labels?: ComAtprotoLabelDefs.Label[];
    /** Set to true when the actor cannot actively participate in converations */
    chatDisabled?: boolean;
    [k: string]: unknown;
}
export declare function isProfileViewBasic(v: unknown): v is ProfileViewBasic;
export declare function validateProfileViewBasic(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map