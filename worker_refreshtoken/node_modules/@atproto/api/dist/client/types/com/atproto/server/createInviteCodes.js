"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isAccountCodes = isAccountCodes;
exports.validateAccountCodes = validateAccountCodes;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isAccountCodes(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.server.createInviteCodes#accountCodes');
}
function validateAccountCodes(v) {
    return lexicons_1.lexicons.validate('com.atproto.server.createInviteCodes#accountCodes', v);
}
//# sourceMappingURL=createInviteCodes.js.map