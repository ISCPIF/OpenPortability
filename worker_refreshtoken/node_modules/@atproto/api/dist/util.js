"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nuxSchema = exports.asDid = exports.isDid = void 0;
exports.sanitizeMutedWordValue = sanitizeMutedWordValue;
exports.savedFeedsToUriArrays = savedFeedsToUriArrays;
exports.getSavedFeedType = getSavedFeedType;
exports.validateSavedFeed = validateSavedFeed;
exports.validateNux = validateNux;
const syntax_1 = require("@atproto/syntax");
const common_web_1 = require("@atproto/common-web");
const zod_1 = __importDefault(require("zod"));
function sanitizeMutedWordValue(value) {
    return (value
        .trim()
        .replace(/^#(?!\ufe0f)/, '')
        // eslint-disable-next-line no-misleading-character-class
        .replace(/[\r\n\u00AD\u2060\u200D\u200C\u200B]+/, ''));
}
function savedFeedsToUriArrays(savedFeeds) {
    const pinned = [];
    const saved = [];
    for (const feed of savedFeeds) {
        if (feed.pinned) {
            pinned.push(feed.value);
            // saved in v1 includes pinned
            saved.push(feed.value);
        }
        else {
            saved.push(feed.value);
        }
    }
    return {
        pinned,
        saved,
    };
}
/**
 * Get the type of a saved feed, used by deprecated methods for backwards
 * compat. Should not be used moving forward. *Invalid URIs will throw.*
 *
 * @param uri - The AT URI of the saved feed
 */
function getSavedFeedType(uri) {
    const urip = new syntax_1.AtUri(uri);
    switch (urip.collection) {
        case 'app.bsky.feed.generator':
            return 'feed';
        case 'app.bsky.graph.list':
            return 'list';
        default:
            return 'unknown';
    }
}
function validateSavedFeed(savedFeed) {
    new common_web_1.TID(savedFeed.id);
    if (['feed', 'list'].includes(savedFeed.type)) {
        const uri = new syntax_1.AtUri(savedFeed.value);
        const isFeed = uri.collection === 'app.bsky.feed.generator';
        const isList = uri.collection === 'app.bsky.graph.list';
        if (savedFeed.type === 'feed' && !isFeed) {
            throw new Error(`Saved feed of type 'feed' must be a feed, got ${uri.collection}`);
        }
        if (savedFeed.type === 'list' && !isList) {
            throw new Error(`Saved feed of type 'list' must be a list, got ${uri.collection}`);
        }
    }
}
// @TODO use tools from @atproto/did
const isDid = (str) => typeof str === 'string' &&
    str.startsWith('did:') &&
    str.includes(':', 4) &&
    str.length > 8 &&
    str.length <= 2048;
exports.isDid = isDid;
const asDid = (value) => {
    if ((0, exports.isDid)(value))
        return value;
    throw new TypeError(`Invalid DID: ${value}`);
};
exports.asDid = asDid;
exports.nuxSchema = zod_1.default
    .object({
    id: zod_1.default.string().max(64),
    completed: zod_1.default.boolean(),
    data: zod_1.default.string().max(300).optional(),
    expiresAt: zod_1.default.string().datetime().optional(),
})
    .strict();
function validateNux(nux) {
    exports.nuxSchema.parse(nux);
}
//# sourceMappingURL=util.js.map