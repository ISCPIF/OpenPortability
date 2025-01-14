/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
import * as AppBskyGraphDefs from '../graph/defs';
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef';
export interface ProfileViewBasic {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    associated?: ProfileAssociated;
    viewer?: ViewerState;
    labels?: ComAtprotoLabelDefs.Label[];
    createdAt?: string;
    [k: string]: unknown;
}
export declare function isProfileViewBasic(v: unknown): v is ProfileViewBasic;
export declare function validateProfileViewBasic(v: unknown): ValidationResult;
export interface ProfileView {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    associated?: ProfileAssociated;
    indexedAt?: string;
    createdAt?: string;
    viewer?: ViewerState;
    labels?: ComAtprotoLabelDefs.Label[];
    [k: string]: unknown;
}
export declare function isProfileView(v: unknown): v is ProfileView;
export declare function validateProfileView(v: unknown): ValidationResult;
export interface ProfileViewDetailed {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    associated?: ProfileAssociated;
    joinedViaStarterPack?: AppBskyGraphDefs.StarterPackViewBasic;
    indexedAt?: string;
    createdAt?: string;
    viewer?: ViewerState;
    labels?: ComAtprotoLabelDefs.Label[];
    pinnedPost?: ComAtprotoRepoStrongRef.Main;
    [k: string]: unknown;
}
export declare function isProfileViewDetailed(v: unknown): v is ProfileViewDetailed;
export declare function validateProfileViewDetailed(v: unknown): ValidationResult;
export interface ProfileAssociated {
    lists?: number;
    feedgens?: number;
    starterPacks?: number;
    labeler?: boolean;
    chat?: ProfileAssociatedChat;
    [k: string]: unknown;
}
export declare function isProfileAssociated(v: unknown): v is ProfileAssociated;
export declare function validateProfileAssociated(v: unknown): ValidationResult;
export interface ProfileAssociatedChat {
    allowIncoming: 'all' | 'none' | 'following' | (string & {});
    [k: string]: unknown;
}
export declare function isProfileAssociatedChat(v: unknown): v is ProfileAssociatedChat;
export declare function validateProfileAssociatedChat(v: unknown): ValidationResult;
/** Metadata about the requesting account's relationship with the subject account. Only has meaningful content for authed requests. */
export interface ViewerState {
    muted?: boolean;
    mutedByList?: AppBskyGraphDefs.ListViewBasic;
    blockedBy?: boolean;
    blocking?: string;
    blockingByList?: AppBskyGraphDefs.ListViewBasic;
    following?: string;
    followedBy?: string;
    knownFollowers?: KnownFollowers;
    [k: string]: unknown;
}
export declare function isViewerState(v: unknown): v is ViewerState;
export declare function validateViewerState(v: unknown): ValidationResult;
/** The subject's followers whom you also follow */
export interface KnownFollowers {
    count: number;
    followers: ProfileViewBasic[];
    [k: string]: unknown;
}
export declare function isKnownFollowers(v: unknown): v is KnownFollowers;
export declare function validateKnownFollowers(v: unknown): ValidationResult;
export type Preferences = (AdultContentPref | ContentLabelPref | SavedFeedsPref | SavedFeedsPrefV2 | PersonalDetailsPref | FeedViewPref | ThreadViewPref | InterestsPref | MutedWordsPref | HiddenPostsPref | BskyAppStatePref | LabelersPref | {
    $type: string;
    [k: string]: unknown;
})[];
export interface AdultContentPref {
    enabled: boolean;
    [k: string]: unknown;
}
export declare function isAdultContentPref(v: unknown): v is AdultContentPref;
export declare function validateAdultContentPref(v: unknown): ValidationResult;
export interface ContentLabelPref {
    /** Which labeler does this preference apply to? If undefined, applies globally. */
    labelerDid?: string;
    label: string;
    visibility: 'ignore' | 'show' | 'warn' | 'hide' | (string & {});
    [k: string]: unknown;
}
export declare function isContentLabelPref(v: unknown): v is ContentLabelPref;
export declare function validateContentLabelPref(v: unknown): ValidationResult;
export interface SavedFeed {
    id: string;
    type: 'feed' | 'list' | 'timeline' | (string & {});
    value: string;
    pinned: boolean;
    [k: string]: unknown;
}
export declare function isSavedFeed(v: unknown): v is SavedFeed;
export declare function validateSavedFeed(v: unknown): ValidationResult;
export interface SavedFeedsPrefV2 {
    items: SavedFeed[];
    [k: string]: unknown;
}
export declare function isSavedFeedsPrefV2(v: unknown): v is SavedFeedsPrefV2;
export declare function validateSavedFeedsPrefV2(v: unknown): ValidationResult;
export interface SavedFeedsPref {
    pinned: string[];
    saved: string[];
    timelineIndex?: number;
    [k: string]: unknown;
}
export declare function isSavedFeedsPref(v: unknown): v is SavedFeedsPref;
export declare function validateSavedFeedsPref(v: unknown): ValidationResult;
export interface PersonalDetailsPref {
    /** The birth date of account owner. */
    birthDate?: string;
    [k: string]: unknown;
}
export declare function isPersonalDetailsPref(v: unknown): v is PersonalDetailsPref;
export declare function validatePersonalDetailsPref(v: unknown): ValidationResult;
export interface FeedViewPref {
    /** The URI of the feed, or an identifier which describes the feed. */
    feed: string;
    /** Hide replies in the feed. */
    hideReplies?: boolean;
    /** Hide replies in the feed if they are not by followed users. */
    hideRepliesByUnfollowed: boolean;
    /** Hide replies in the feed if they do not have this number of likes. */
    hideRepliesByLikeCount?: number;
    /** Hide reposts in the feed. */
    hideReposts?: boolean;
    /** Hide quote posts in the feed. */
    hideQuotePosts?: boolean;
    [k: string]: unknown;
}
export declare function isFeedViewPref(v: unknown): v is FeedViewPref;
export declare function validateFeedViewPref(v: unknown): ValidationResult;
export interface ThreadViewPref {
    /** Sorting mode for threads. */
    sort?: 'oldest' | 'newest' | 'most-likes' | 'random' | 'hotness' | (string & {});
    /** Show followed users at the top of all replies. */
    prioritizeFollowedUsers?: boolean;
    [k: string]: unknown;
}
export declare function isThreadViewPref(v: unknown): v is ThreadViewPref;
export declare function validateThreadViewPref(v: unknown): ValidationResult;
export interface InterestsPref {
    /** A list of tags which describe the account owner's interests gathered during onboarding. */
    tags: string[];
    [k: string]: unknown;
}
export declare function isInterestsPref(v: unknown): v is InterestsPref;
export declare function validateInterestsPref(v: unknown): ValidationResult;
export type MutedWordTarget = 'content' | 'tag' | (string & {});
/** A word that the account owner has muted. */
export interface MutedWord {
    id?: string;
    /** The muted word itself. */
    value: string;
    /** The intended targets of the muted word. */
    targets: MutedWordTarget[];
    /** Groups of users to apply the muted word to. If undefined, applies to all users. */
    actorTarget: 'all' | 'exclude-following' | (string & {});
    /** The date and time at which the muted word will expire and no longer be applied. */
    expiresAt?: string;
    [k: string]: unknown;
}
export declare function isMutedWord(v: unknown): v is MutedWord;
export declare function validateMutedWord(v: unknown): ValidationResult;
export interface MutedWordsPref {
    /** A list of words the account owner has muted. */
    items: MutedWord[];
    [k: string]: unknown;
}
export declare function isMutedWordsPref(v: unknown): v is MutedWordsPref;
export declare function validateMutedWordsPref(v: unknown): ValidationResult;
export interface HiddenPostsPref {
    /** A list of URIs of posts the account owner has hidden. */
    items: string[];
    [k: string]: unknown;
}
export declare function isHiddenPostsPref(v: unknown): v is HiddenPostsPref;
export declare function validateHiddenPostsPref(v: unknown): ValidationResult;
export interface LabelersPref {
    labelers: LabelerPrefItem[];
    [k: string]: unknown;
}
export declare function isLabelersPref(v: unknown): v is LabelersPref;
export declare function validateLabelersPref(v: unknown): ValidationResult;
export interface LabelerPrefItem {
    did: string;
    [k: string]: unknown;
}
export declare function isLabelerPrefItem(v: unknown): v is LabelerPrefItem;
export declare function validateLabelerPrefItem(v: unknown): ValidationResult;
/** A grab bag of state that's specific to the bsky.app program. Third-party apps shouldn't use this. */
export interface BskyAppStatePref {
    activeProgressGuide?: BskyAppProgressGuide;
    /** An array of tokens which identify nudges (modals, popups, tours, highlight dots) that should be shown to the user. */
    queuedNudges?: string[];
    /** Storage for NUXs the user has encountered. */
    nuxs?: Nux[];
    [k: string]: unknown;
}
export declare function isBskyAppStatePref(v: unknown): v is BskyAppStatePref;
export declare function validateBskyAppStatePref(v: unknown): ValidationResult;
/** If set, an active progress guide. Once completed, can be set to undefined. Should have unspecced fields tracking progress. */
export interface BskyAppProgressGuide {
    guide: string;
    [k: string]: unknown;
}
export declare function isBskyAppProgressGuide(v: unknown): v is BskyAppProgressGuide;
export declare function validateBskyAppProgressGuide(v: unknown): ValidationResult;
/** A new user experiences (NUX) storage object */
export interface Nux {
    id: string;
    completed: boolean;
    /** Arbitrary data for the NUX. The structure is defined by the NUX itself. Limited to 300 characters. */
    data?: string;
    /** The date and time at which the NUX will expire and should be considered completed. */
    expiresAt?: string;
    [k: string]: unknown;
}
export declare function isNux(v: unknown): v is Nux;
export declare function validateNux(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map