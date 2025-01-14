"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMain = isMain;
exports.validateMain = validateMain;
exports.isView = isView;
exports.validateView = validateView;
exports.isViewRecord = isViewRecord;
exports.validateViewRecord = validateViewRecord;
exports.isViewNotFound = isViewNotFound;
exports.validateViewNotFound = validateViewNotFound;
exports.isViewBlocked = isViewBlocked;
exports.validateViewBlocked = validateViewBlocked;
exports.isViewDetached = isViewDetached;
exports.validateViewDetached = validateViewDetached;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isMain(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.embed.record#main' ||
            v.$type === 'app.bsky.embed.record'));
}
function validateMain(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.record#main', v);
}
function isView(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.embed.record#view');
}
function validateView(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.record#view', v);
}
function isViewRecord(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.record#viewRecord');
}
function validateViewRecord(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.record#viewRecord', v);
}
function isViewNotFound(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.record#viewNotFound');
}
function validateViewNotFound(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.record#viewNotFound', v);
}
function isViewBlocked(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.record#viewBlocked');
}
function validateViewBlocked(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.record#viewBlocked', v);
}
function isViewDetached(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.record#viewDetached');
}
function validateViewDetached(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.record#viewDetached', v);
}
//# sourceMappingURL=record.js.map