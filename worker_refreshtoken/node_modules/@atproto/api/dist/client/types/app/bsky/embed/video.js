"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMain = isMain;
exports.validateMain = validateMain;
exports.isCaption = isCaption;
exports.validateCaption = validateCaption;
exports.isView = isView;
exports.validateView = validateView;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isMain(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.embed.video#main' ||
            v.$type === 'app.bsky.embed.video'));
}
function validateMain(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.video#main', v);
}
function isCaption(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.video#caption');
}
function validateCaption(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.video#caption', v);
}
function isView(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.embed.video#view');
}
function validateView(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.video#view', v);
}
//# sourceMappingURL=video.js.map