"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthFactorTokenRequiredError = exports.AccountTakedownError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class AccountTakedownError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.AccountTakedownError = AccountTakedownError;
class AuthFactorTokenRequiredError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.AuthFactorTokenRequiredError = AuthFactorTokenRequiredError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'AccountTakedown')
            return new AccountTakedownError(e);
        if (e.error === 'AuthFactorTokenRequired')
            return new AuthFactorTokenRequiredError(e);
    }
    return e;
}
//# sourceMappingURL=createSession.js.map