"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAspectRatio = isAspectRatio;
exports.validateAspectRatio = validateAspectRatio;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isAspectRatio(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.embed.defs#aspectRatio');
}
function validateAspectRatio(v) {
    return lexicons_1.lexicons.validate('app.bsky.embed.defs#aspectRatio', v);
}
//# sourceMappingURL=defs.js.map