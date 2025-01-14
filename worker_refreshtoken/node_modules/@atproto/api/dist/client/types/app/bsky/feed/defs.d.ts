/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as AppBskyActorDefs from '../actor/defs';
import * as AppBskyEmbedImages from '../embed/images';
import * as AppBskyEmbedVideo from '../embed/video';
import * as AppBskyEmbedExternal from '../embed/external';
import * as AppBskyEmbedRecord from '../embed/record';
import * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
import * as AppBskyRichtextFacet from '../richtext/facet';
import * as AppBskyGraphDefs from '../graph/defs';
export interface PostView {
    uri: string;
    cid: string;
    author: AppBskyActorDefs.ProfileViewBasic;
    record: {};
    embed?: AppBskyEmbedImages.View | AppBskyEmbedVideo.View | AppBskyEmbedExternal.View | AppBskyEmbedRecord.View | AppBskyEmbedRecordWithMedia.View | {
        $type: string;
        [k: string]: unknown;
    };
    replyCount?: number;
    repostCount?: number;
    likeCount?: number;
    quoteCount?: number;
    indexedAt: string;
    viewer?: ViewerState;
    labels?: ComAtprotoLabelDefs.Label[];
    threadgate?: ThreadgateView;
    [k: string]: unknown;
}
export declare function isPostView(v: unknown): v is PostView;
export declare function validatePostView(v: unknown): ValidationResult;
/** Metadata about the requesting account's relationship with the subject content. Only has meaningful content for authed requests. */
export interface ViewerState {
    repost?: string;
    like?: string;
    threadMuted?: boolean;
    replyDisabled?: boolean;
    embeddingDisabled?: boolean;
    pinned?: boolean;
    [k: string]: unknown;
}
export declare function isViewerState(v: unknown): v is ViewerState;
export declare function validateViewerState(v: unknown): ValidationResult;
export interface FeedViewPost {
    post: PostView;
    reply?: ReplyRef;
    reason?: ReasonRepost | ReasonPin | {
        $type: string;
        [k: string]: unknown;
    };
    /** Context provided by feed generator that may be passed back alongside interactions. */
    feedContext?: string;
    [k: string]: unknown;
}
export declare function isFeedViewPost(v: unknown): v is FeedViewPost;
export declare function validateFeedViewPost(v: unknown): ValidationResult;
export interface ReplyRef {
    root: PostView | NotFoundPost | BlockedPost | {
        $type: string;
        [k: string]: unknown;
    };
    parent: PostView | NotFoundPost | BlockedPost | {
        $type: string;
        [k: string]: unknown;
    };
    grandparentAuthor?: AppBskyActorDefs.ProfileViewBasic;
    [k: string]: unknown;
}
export declare function isReplyRef(v: unknown): v is ReplyRef;
export declare function validateReplyRef(v: unknown): ValidationResult;
export interface ReasonRepost {
    by: AppBskyActorDefs.ProfileViewBasic;
    indexedAt: string;
    [k: string]: unknown;
}
export declare function isReasonRepost(v: unknown): v is ReasonRepost;
export declare function validateReasonRepost(v: unknown): ValidationResult;
export interface ReasonPin {
    [k: string]: unknown;
}
export declare function isReasonPin(v: unknown): v is ReasonPin;
export declare function validateReasonPin(v: unknown): ValidationResult;
export interface ThreadViewPost {
    post: PostView;
    parent?: ThreadViewPost | NotFoundPost | BlockedPost | {
        $type: string;
        [k: string]: unknown;
    };
    replies?: (ThreadViewPost | NotFoundPost | BlockedPost | {
        $type: string;
        [k: string]: unknown;
    })[];
    [k: string]: unknown;
}
export declare function isThreadViewPost(v: unknown): v is ThreadViewPost;
export declare function validateThreadViewPost(v: unknown): ValidationResult;
export interface NotFoundPost {
    uri: string;
    notFound: true;
    [k: string]: unknown;
}
export declare function isNotFoundPost(v: unknown): v is NotFoundPost;
export declare function validateNotFoundPost(v: unknown): ValidationResult;
export interface BlockedPost {
    uri: string;
    blocked: true;
    author: BlockedAuthor;
    [k: string]: unknown;
}
export declare function isBlockedPost(v: unknown): v is BlockedPost;
export declare function validateBlockedPost(v: unknown): ValidationResult;
export interface BlockedAuthor {
    did: string;
    viewer?: AppBskyActorDefs.ViewerState;
    [k: string]: unknown;
}
export declare function isBlockedAuthor(v: unknown): v is BlockedAuthor;
export declare function validateBlockedAuthor(v: unknown): ValidationResult;
export interface GeneratorView {
    uri: string;
    cid: string;
    did: string;
    creator: AppBskyActorDefs.ProfileView;
    displayName: string;
    description?: string;
    descriptionFacets?: AppBskyRichtextFacet.Main[];
    avatar?: string;
    likeCount?: number;
    acceptsInteractions?: boolean;
    labels?: ComAtprotoLabelDefs.Label[];
    viewer?: GeneratorViewerState;
    indexedAt: string;
    [k: string]: unknown;
}
export declare function isGeneratorView(v: unknown): v is GeneratorView;
export declare function validateGeneratorView(v: unknown): ValidationResult;
export interface GeneratorViewerState {
    like?: string;
    [k: string]: unknown;
}
export declare function isGeneratorViewerState(v: unknown): v is GeneratorViewerState;
export declare function validateGeneratorViewerState(v: unknown): ValidationResult;
export interface SkeletonFeedPost {
    post: string;
    reason?: SkeletonReasonRepost | SkeletonReasonPin | {
        $type: string;
        [k: string]: unknown;
    };
    /** Context that will be passed through to client and may be passed to feed generator back alongside interactions. */
    feedContext?: string;
    [k: string]: unknown;
}
export declare function isSkeletonFeedPost(v: unknown): v is SkeletonFeedPost;
export declare function validateSkeletonFeedPost(v: unknown): ValidationResult;
export interface SkeletonReasonRepost {
    repost: string;
    [k: string]: unknown;
}
export declare function isSkeletonReasonRepost(v: unknown): v is SkeletonReasonRepost;
export declare function validateSkeletonReasonRepost(v: unknown): ValidationResult;
export interface SkeletonReasonPin {
    [k: string]: unknown;
}
export declare function isSkeletonReasonPin(v: unknown): v is SkeletonReasonPin;
export declare function validateSkeletonReasonPin(v: unknown): ValidationResult;
export interface ThreadgateView {
    uri?: string;
    cid?: string;
    record?: {};
    lists?: AppBskyGraphDefs.ListViewBasic[];
    [k: string]: unknown;
}
export declare function isThreadgateView(v: unknown): v is ThreadgateView;
export declare function validateThreadgateView(v: unknown): ValidationResult;
export interface Interaction {
    item?: string;
    event?: 'app.bsky.feed.defs#requestLess' | 'app.bsky.feed.defs#requestMore' | 'app.bsky.feed.defs#clickthroughItem' | 'app.bsky.feed.defs#clickthroughAuthor' | 'app.bsky.feed.defs#clickthroughReposter' | 'app.bsky.feed.defs#clickthroughEmbed' | 'app.bsky.feed.defs#interactionSeen' | 'app.bsky.feed.defs#interactionLike' | 'app.bsky.feed.defs#interactionRepost' | 'app.bsky.feed.defs#interactionReply' | 'app.bsky.feed.defs#interactionQuote' | 'app.bsky.feed.defs#interactionShare' | (string & {});
    /** Context on a feed item that was originally supplied by the feed generator on getFeedSkeleton. */
    feedContext?: string;
    [k: string]: unknown;
}
export declare function isInteraction(v: unknown): v is Interaction;
export declare function validateInteraction(v: unknown): ValidationResult;
/** Request that less content like the given feed item be shown in the feed */
export declare const REQUESTLESS = "app.bsky.feed.defs#requestLess";
/** Request that more content like the given feed item be shown in the feed */
export declare const REQUESTMORE = "app.bsky.feed.defs#requestMore";
/** User clicked through to the feed item */
export declare const CLICKTHROUGHITEM = "app.bsky.feed.defs#clickthroughItem";
/** User clicked through to the author of the feed item */
export declare const CLICKTHROUGHAUTHOR = "app.bsky.feed.defs#clickthroughAuthor";
/** User clicked through to the reposter of the feed item */
export declare const CLICKTHROUGHREPOSTER = "app.bsky.feed.defs#clickthroughReposter";
/** User clicked through to the embedded content of the feed item */
export declare const CLICKTHROUGHEMBED = "app.bsky.feed.defs#clickthroughEmbed";
/** Feed item was seen by user */
export declare const INTERACTIONSEEN = "app.bsky.feed.defs#interactionSeen";
/** User liked the feed item */
export declare const INTERACTIONLIKE = "app.bsky.feed.defs#interactionLike";
/** User reposted the feed item */
export declare const INTERACTIONREPOST = "app.bsky.feed.defs#interactionRepost";
/** User replied to the feed item */
export declare const INTERACTIONREPLY = "app.bsky.feed.defs#interactionReply";
/** User quoted the feed item */
export declare const INTERACTIONQUOTE = "app.bsky.feed.defs#interactionQuote";
/** User shared the feed item */
export declare const INTERACTIONSHARE = "app.bsky.feed.defs#interactionShare";
//# sourceMappingURL=defs.d.ts.map