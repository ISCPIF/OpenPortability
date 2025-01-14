"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isFeed = isFeed;
exports.validateFeed = validateFeed;
exports.isLinks = isLinks;
exports.validateLinks = validateLinks;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isFeed(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.describeFeedGenerator#feed');
}
function validateFeed(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.describeFeedGenerator#feed', v);
}
function isLinks(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.describeFeedGenerator#links');
}
function validateLinks(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.describeFeedGenerator#links', v);
}
//# sourceMappingURL=describeFeedGenerator.js.map