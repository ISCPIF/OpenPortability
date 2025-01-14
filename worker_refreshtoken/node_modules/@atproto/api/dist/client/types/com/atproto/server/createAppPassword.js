"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountTakedownError = void 0;
exports.toKnownErr = toKnownErr;
exports.isAppPassword = isAppPassword;
exports.validateAppPassword = validateAppPassword;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
class AccountTakedownError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.AccountTakedownError = AccountTakedownError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'AccountTakedown')
            return new AccountTakedownError(e);
    }
    return e;
}
function isAppPassword(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.server.createAppPassword#appPassword');
}
function validateAppPassword(v) {
    return lexicons_1.lexicons.validate('com.atproto.server.createAppPassword#appPassword', v);
}
//# sourceMappingURL=createAppPassword.js.map