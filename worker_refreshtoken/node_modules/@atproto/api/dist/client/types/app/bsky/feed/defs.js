"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERACTIONSHARE = exports.INTERACTIONQUOTE = exports.INTERACTIONREPLY = exports.INTERACTIONREPOST = exports.INTERACTIONLIKE = exports.INTERACTIONSEEN = exports.CLICKTHROUGHEMBED = exports.CLICKTHROUGHREPOSTER = exports.CLICKTHROUGHAUTHOR = exports.CLICKTHROUGHITEM = exports.REQUESTMORE = exports.REQUESTLESS = void 0;
exports.isPostView = isPostView;
exports.validatePostView = validatePostView;
exports.isViewerState = isViewerState;
exports.validateViewerState = validateViewerState;
exports.isFeedViewPost = isFeedViewPost;
exports.validateFeedViewPost = validateFeedViewPost;
exports.isReplyRef = isReplyRef;
exports.validateReplyRef = validateReplyRef;
exports.isReasonRepost = isReasonRepost;
exports.validateReasonRepost = validateReasonRepost;
exports.isReasonPin = isReasonPin;
exports.validateReasonPin = validateReasonPin;
exports.isThreadViewPost = isThreadViewPost;
exports.validateThreadViewPost = validateThreadViewPost;
exports.isNotFoundPost = isNotFoundPost;
exports.validateNotFoundPost = validateNotFoundPost;
exports.isBlockedPost = isBlockedPost;
exports.validateBlockedPost = validateBlockedPost;
exports.isBlockedAuthor = isBlockedAuthor;
exports.validateBlockedAuthor = validateBlockedAuthor;
exports.isGeneratorView = isGeneratorView;
exports.validateGeneratorView = validateGeneratorView;
exports.isGeneratorViewerState = isGeneratorViewerState;
exports.validateGeneratorViewerState = validateGeneratorViewerState;
exports.isSkeletonFeedPost = isSkeletonFeedPost;
exports.validateSkeletonFeedPost = validateSkeletonFeedPost;
exports.isSkeletonReasonRepost = isSkeletonReasonRepost;
exports.validateSkeletonReasonRepost = validateSkeletonReasonRepost;
exports.isSkeletonReasonPin = isSkeletonReasonPin;
exports.validateSkeletonReasonPin = validateSkeletonReasonPin;
exports.isThreadgateView = isThreadgateView;
exports.validateThreadgateView = validateThreadgateView;
exports.isInteraction = isInteraction;
exports.validateInteraction = validateInteraction;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isPostView(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.feed.defs#postView');
}
function validatePostView(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#postView', v);
}
function isViewerState(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#viewerState');
}
function validateViewerState(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#viewerState', v);
}
function isFeedViewPost(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#feedViewPost');
}
function validateFeedViewPost(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#feedViewPost', v);
}
function isReplyRef(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.feed.defs#replyRef');
}
function validateReplyRef(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#replyRef', v);
}
function isReasonRepost(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#reasonRepost');
}
function validateReasonRepost(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#reasonRepost', v);
}
function isReasonPin(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#reasonPin');
}
function validateReasonPin(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#reasonPin', v);
}
function isThreadViewPost(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#threadViewPost');
}
function validateThreadViewPost(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#threadViewPost', v);
}
function isNotFoundPost(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#notFoundPost');
}
function validateNotFoundPost(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#notFoundPost', v);
}
function isBlockedPost(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#blockedPost');
}
function validateBlockedPost(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#blockedPost', v);
}
function isBlockedAuthor(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#blockedAuthor');
}
function validateBlockedAuthor(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#blockedAuthor', v);
}
function isGeneratorView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#generatorView');
}
function validateGeneratorView(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#generatorView', v);
}
function isGeneratorViewerState(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#generatorViewerState');
}
function validateGeneratorViewerState(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#generatorViewerState', v);
}
function isSkeletonFeedPost(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#skeletonFeedPost');
}
function validateSkeletonFeedPost(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#skeletonFeedPost', v);
}
function isSkeletonReasonRepost(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#skeletonReasonRepost');
}
function validateSkeletonReasonRepost(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#skeletonReasonRepost', v);
}
function isSkeletonReasonPin(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#skeletonReasonPin');
}
function validateSkeletonReasonPin(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#skeletonReasonPin', v);
}
function isThreadgateView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#threadgateView');
}
function validateThreadgateView(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#threadgateView', v);
}
function isInteraction(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.defs#interaction');
}
function validateInteraction(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.defs#interaction', v);
}
/** Request that less content like the given feed item be shown in the feed */
exports.REQUESTLESS = 'app.bsky.feed.defs#requestLess';
/** Request that more content like the given feed item be shown in the feed */
exports.REQUESTMORE = 'app.bsky.feed.defs#requestMore';
/** User clicked through to the feed item */
exports.CLICKTHROUGHITEM = 'app.bsky.feed.defs#clickthroughItem';
/** User clicked through to the author of the feed item */
exports.CLICKTHROUGHAUTHOR = 'app.bsky.feed.defs#clickthroughAuthor';
/** User clicked through to the reposter of the feed item */
exports.CLICKTHROUGHREPOSTER = 'app.bsky.feed.defs#clickthroughReposter';
/** User clicked through to the embedded content of the feed item */
exports.CLICKTHROUGHEMBED = 'app.bsky.feed.defs#clickthroughEmbed';
/** Feed item was seen by user */
exports.INTERACTIONSEEN = 'app.bsky.feed.defs#interactionSeen';
/** User liked the feed item */
exports.INTERACTIONLIKE = 'app.bsky.feed.defs#interactionLike';
/** User reposted the feed item */
exports.INTERACTIONREPOST = 'app.bsky.feed.defs#interactionRepost';
/** User replied to the feed item */
exports.INTERACTIONREPLY = 'app.bsky.feed.defs#interactionReply';
/** User quoted the feed item */
exports.INTERACTIONQUOTE = 'app.bsky.feed.defs#interactionQuote';
/** User shared the feed item */
exports.INTERACTIONSHARE = 'app.bsky.feed.defs#interactionShare';
//# sourceMappingURL=defs.js.map