"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.validateRecord = validateRecord;
exports.isDisableRule = isDisableRule;
exports.validateDisableRule = validateDisableRule;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isRecord(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.feed.postgate#main' ||
            v.$type === 'app.bsky.feed.postgate'));
}
function validateRecord(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.postgate#main', v);
}
function isDisableRule(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.postgate#disableRule');
}
function validateDisableRule(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.postgate#disableRule', v);
}
//# sourceMappingURL=postgate.js.map