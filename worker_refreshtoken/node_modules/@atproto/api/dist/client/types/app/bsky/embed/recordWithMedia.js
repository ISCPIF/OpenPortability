"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMain = isMain;
exports.validateMain = validateMain;
exports.isView = isView;
exports.validateView = validateView;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isMain(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'app.bsky.embed.recordWithMedia#main' ||
            v.$type === 'app.bsky.embed.recordWithMedia'));
}
function validateMain(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.recordWithMedia#main', v);
}
function isView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.recordWithMedia#view');
}
function validateView(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.recordWithMedia#view', v);
}
//# sourceMappingURL=recordWithMedia.js.map