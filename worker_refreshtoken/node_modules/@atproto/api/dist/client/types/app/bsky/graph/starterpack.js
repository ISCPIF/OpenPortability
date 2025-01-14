"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.validateRecord = validateRecord;
exports.isFeedItem = isFeedItem;
exports.validateFeedItem = validateFeedItem;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isRecord(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.graph.starterpack#main' ||
            v.$type === 'app.bsky.graph.starterpack'));
}
function validateRecord(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.starterpack#main', v);
}
function isFeedItem(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.starterpack#feedItem');
}
function validateFeedItem(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.starterpack#feedItem', v);
}
//# sourceMappingURL=starterpack.js.map