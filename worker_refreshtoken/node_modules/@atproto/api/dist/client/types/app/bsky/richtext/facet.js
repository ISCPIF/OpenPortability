"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMain = isMain;
exports.validateMain = validateMain;
exports.isMention = isMention;
exports.validateMention = validateMention;
exports.isLink = isLink;
exports.validateLink = validateLink;
exports.isTag = isTag;
exports.validateTag = validateTag;
exports.isByteSlice = isByteSlice;
exports.validateByteSlice = validateByteSlice;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isMain(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.richtext.facet#main' ||
            v.$type === 'app.bsky.richtext.facet'));
}
function validateMain(v) {
    return lexicons_1.lexicons.validate('app.bsky.richtext.facet#main', v);
}
function isMention(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.richtext.facet#mention');
}
function validateMention(v) {
    return lexicons_1.lexicons.validate('app.bsky.richtext.facet#mention', v);
}
function isLink(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.richtext.facet#link');
}
function validateLink(v) {
    return lexicons_1.lexicons.validate('app.bsky.richtext.facet#link', v);
}
function isTag(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.richtext.facet#tag');
}
function validateTag(v) {
    return lexicons_1.lexicons.validate('app.bsky.richtext.facet#tag', v);
}
function isByteSlice(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.richtext.facet#byteSlice');
}
function validateByteSlice(v) {
    return lexicons_1.lexicons.validate('app.bsky.richtext.facet#byteSlice', v);
}
//# sourceMappingURL=facet.js.map