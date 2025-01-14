"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStatusAttr = isStatusAttr;
exports.validateStatusAttr = validateStatusAttr;
exports.isAccountView = isAccountView;
exports.validateAccountView = validateAccountView;
exports.isRepoRef = isRepoRef;
exports.validateRepoRef = validateRepoRef;
exports.isRepoBlobRef = isRepoBlobRef;
exports.validateRepoBlobRef = validateRepoBlobRef;
exports.isThreatSignature = isThreatSignature;
exports.validateThreatSignature = validateThreatSignature;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isStatusAttr(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.admin.defs#statusAttr');
}
function validateStatusAttr(v) {
    return lexicons_1.lexicons.validate('com.atproto.admin.defs#statusAttr', v);
}
function isAccountView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.admin.defs#accountView');
}
function validateAccountView(v) {
    return lexicons_1.lexicons.validate('com.atproto.admin.defs#accountView', v);
}
function isRepoRef(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.admin.defs#repoRef');
}
function validateRepoRef(v) {
    return lexicons_1.lexicons.validate('com.atproto.admin.defs#repoRef', v);
}
function isRepoBlobRef(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.admin.defs#repoBlobRef');
}
function validateRepoBlobRef(v) {
    return lexicons_1.lexicons.validate('com.atproto.admin.defs#repoBlobRef', v);
}
function isThreatSignature(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.admin.defs#threatSignature');
}
function validateThreatSignature(v) {
    return lexicons_1.lexicons.validate('com.atproto.admin.defs#threatSignature', v);
}
//# sourceMappingURL=defs.js.map