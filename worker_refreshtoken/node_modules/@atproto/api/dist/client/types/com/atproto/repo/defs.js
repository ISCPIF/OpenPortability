"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCommitMeta = isCommitMeta;
exports.validateCommitMeta = validateCommitMeta;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isCommitMeta(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.repo.defs#commitMeta');
}
function validateCommitMeta(v) {
    return lexicons_1.lexicons.validate('com.atproto.repo.defs#commitMeta', v);
}
//# sourceMappingURL=defs.js.map