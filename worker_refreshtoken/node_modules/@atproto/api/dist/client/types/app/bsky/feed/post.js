"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.validateRecord = validateRecord;
exports.isReplyRef = isReplyRef;
exports.validateReplyRef = validateReplyRef;
exports.isEntity = isEntity;
exports.validateEntity = validateEntity;
exports.isTextSlice = isTextSlice;
exports.validateTextSlice = validateTextSlice;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isRecord(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.feed.post#main' || v.$type === 'app.bsky.feed.post'));
}
function validateRecord(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.post#main', v);
}
function isReplyRef(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.feed.post#replyRef');
}
function validateReplyRef(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.post#replyRef', v);
}
function isEntity(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.feed.post#entity');
}
function validateEntity(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.post#entity', v);
}
function isTextSlice(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.feed.post#textSlice');
}
function validateTextSlice(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.post#textSlice', v);
}
//# sourceMappingURL=post.js.map