"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.validateRecord = validateRecord;
exports.isMentionRule = isMentionRule;
exports.validateMentionRule = validateMentionRule;
exports.isFollowingRule = isFollowingRule;
exports.validateFollowingRule = validateFollowingRule;
exports.isListRule = isListRule;
exports.validateListRule = validateListRule;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isRecord(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.feed.threadgate#main' ||
            v.$type === 'app.bsky.feed.threadgate'));
}
function validateRecord(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.threadgate#main', v);
}
function isMentionRule(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.threadgate#mentionRule');
}
function validateMentionRule(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.threadgate#mentionRule', v);
}
function isFollowingRule(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.threadgate#followingRule');
}
function validateFollowingRule(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.threadgate#followingRule', v);
}
function isListRule(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.threadgate#listRule');
}
function validateListRule(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.threadgate#listRule', v);
}
//# sourceMappingURL=threadgate.js.map