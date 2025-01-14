"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMain = isMain;
exports.validateMain = validateMain;
exports.isExternal = isExternal;
exports.validateExternal = validateExternal;
exports.isView = isView;
exports.validateView = validateView;
exports.isViewExternal = isViewExternal;
exports.validateViewExternal = validateViewExternal;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isMain(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.embed.external#main' ||
            v.$type === 'app.bsky.embed.external'));
}
function validateMain(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.external#main', v);
}
function isExternal(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.external#external');
}
function validateExternal(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.external#external', v);
}
function isView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.external#view');
}
function validateView(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.external#view', v);
}
function isViewExternal(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.external#viewExternal');
}
function validateViewExternal(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.external#viewExternal', v);
}
//# sourceMappingURL=external.js.map