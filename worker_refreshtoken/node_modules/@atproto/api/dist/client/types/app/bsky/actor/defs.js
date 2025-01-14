"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProfileViewBasic = isProfileViewBasic;
exports.validateProfileViewBasic = validateProfileViewBasic;
exports.isProfileView = isProfileView;
exports.validateProfileView = validateProfileView;
exports.isProfileViewDetailed = isProfileViewDetailed;
exports.validateProfileViewDetailed = validateProfileViewDetailed;
exports.isProfileAssociated = isProfileAssociated;
exports.validateProfileAssociated = validateProfileAssociated;
exports.isProfileAssociatedChat = isProfileAssociatedChat;
exports.validateProfileAssociatedChat = validateProfileAssociatedChat;
exports.isViewerState = isViewerState;
exports.validateViewerState = validateViewerState;
exports.isKnownFollowers = isKnownFollowers;
exports.validateKnownFollowers = validateKnownFollowers;
exports.isAdultContentPref = isAdultContentPref;
exports.validateAdultContentPref = validateAdultContentPref;
exports.isContentLabelPref = isContentLabelPref;
exports.validateContentLabelPref = validateContentLabelPref;
exports.isSavedFeed = isSavedFeed;
exports.validateSavedFeed = validateSavedFeed;
exports.isSavedFeedsPrefV2 = isSavedFeedsPrefV2;
exports.validateSavedFeedsPrefV2 = validateSavedFeedsPrefV2;
exports.isSavedFeedsPref = isSavedFeedsPref;
exports.validateSavedFeedsPref = validateSavedFeedsPref;
exports.isPersonalDetailsPref = isPersonalDetailsPref;
exports.validatePersonalDetailsPref = validatePersonalDetailsPref;
exports.isFeedViewPref = isFeedViewPref;
exports.validateFeedViewPref = validateFeedViewPref;
exports.isThreadViewPref = isThreadViewPref;
exports.validateThreadViewPref = validateThreadViewPref;
exports.isInterestsPref = isInterestsPref;
exports.validateInterestsPref = validateInterestsPref;
exports.isMutedWord = isMutedWord;
exports.validateMutedWord = validateMutedWord;
exports.isMutedWordsPref = isMutedWordsPref;
exports.validateMutedWordsPref = validateMutedWordsPref;
exports.isHiddenPostsPref = isHiddenPostsPref;
exports.validateHiddenPostsPref = validateHiddenPostsPref;
exports.isLabelersPref = isLabelersPref;
exports.validateLabelersPref = validateLabelersPref;
exports.isLabelerPrefItem = isLabelerPrefItem;
exports.validateLabelerPrefItem = validateLabelerPrefItem;
exports.isBskyAppStatePref = isBskyAppStatePref;
exports.validateBskyAppStatePref = validateBskyAppStatePref;
exports.isBskyAppProgressGuide = isBskyAppProgressGuide;
exports.validateBskyAppProgressGuide = validateBskyAppProgressGuide;
exports.isNux = isNux;
exports.validateNux = validateNux;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isProfileViewBasic(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#profileViewBasic');
}
function validateProfileViewBasic(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#profileViewBasic', v);
}
function isProfileView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#profileView');
}
function validateProfileView(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#profileView', v);
}
function isProfileViewDetailed(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#profileViewDetailed');
}
function validateProfileViewDetailed(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#profileViewDetailed', v);
}
function isProfileAssociated(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#profileAssociated');
}
function validateProfileAssociated(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#profileAssociated', v);
}
function isProfileAssociatedChat(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#profileAssociatedChat');
}
function validateProfileAssociatedChat(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#profileAssociatedChat', v);
}
function isViewerState(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#viewerState');
}
function validateViewerState(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#viewerState', v);
}
function isKnownFollowers(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#knownFollowers');
}
function validateKnownFollowers(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#knownFollowers', v);
}
function isAdultContentPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#adultContentPref');
}
function validateAdultContentPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#adultContentPref', v);
}
function isContentLabelPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#contentLabelPref');
}
function validateContentLabelPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#contentLabelPref', v);
}
function isSavedFeed(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#savedFeed');
}
function validateSavedFeed(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#savedFeed', v);
}
function isSavedFeedsPrefV2(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#savedFeedsPrefV2');
}
function validateSavedFeedsPrefV2(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#savedFeedsPrefV2', v);
}
function isSavedFeedsPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#savedFeedsPref');
}
function validateSavedFeedsPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#savedFeedsPref', v);
}
function isPersonalDetailsPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#personalDetailsPref');
}
function validatePersonalDetailsPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#personalDetailsPref', v);
}
function isFeedViewPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#feedViewPref');
}
function validateFeedViewPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#feedViewPref', v);
}
function isThreadViewPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#threadViewPref');
}
function validateThreadViewPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#threadViewPref', v);
}
function isInterestsPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#interestsPref');
}
function validateInterestsPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#interestsPref', v);
}
function isMutedWord(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#mutedWord');
}
function validateMutedWord(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#mutedWord', v);
}
function isMutedWordsPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#mutedWordsPref');
}
function validateMutedWordsPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#mutedWordsPref', v);
}
function isHiddenPostsPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#hiddenPostsPref');
}
function validateHiddenPostsPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#hiddenPostsPref', v);
}
function isLabelersPref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#labelersPref');
}
function validateLabelersPref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#labelersPref', v);
}
function isLabelerPrefItem(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#labelerPrefItem');
}
function validateLabelerPrefItem(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#labelerPrefItem', v);
}
function isBskyAppStatePref(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#bskyAppStatePref');
}
function validateBskyAppStatePref(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#bskyAppStatePref', v);
}
function isBskyAppProgressGuide(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.actor.defs#bskyAppProgressGuide');
}
function validateBskyAppProgressGuide(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#bskyAppProgressGuide', v);
}
function isNux(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.actor.defs#nux');
}
function validateNux(v) {
    return lexicons_1.lexicons.validate('app.bsky.actor.defs#nux', v);
}
//# sourceMappingURL=defs.js.map