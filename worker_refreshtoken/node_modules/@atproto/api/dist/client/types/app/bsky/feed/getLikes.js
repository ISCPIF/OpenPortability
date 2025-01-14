"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isLike = isLike;
exports.validateLike = validateLike;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isLike(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'app.bsky.feed.getLikes#like');
}
function validateLike(v) {
    return lexicons_1.lexicons.validate('app.bsky.feed.getLikes#like', v);
}
//# sourceMappingURL=getLikes.js.map