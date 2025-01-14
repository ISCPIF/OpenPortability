"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInviteCode = isInviteCode;
exports.validateInviteCode = validateInviteCode;
exports.isInviteCodeUse = isInviteCodeUse;
exports.validateInviteCodeUse = validateInviteCodeUse;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isInviteCode(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.server.defs#inviteCode');
}
function validateInviteCode(v) {
    return lexicons_1.lexicons.validate('com.atproto.server.defs#inviteCode', v);
}
function isInviteCodeUse(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.server.defs#inviteCodeUse');
}
function validateInviteCodeUse(v) {
    return lexicons_1.lexicons.validate('com.atproto.server.defs#inviteCodeUse', v);
}
//# sourceMappingURL=defs.js.map