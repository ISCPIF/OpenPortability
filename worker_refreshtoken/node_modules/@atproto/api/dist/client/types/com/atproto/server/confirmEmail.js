"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidEmailError = exports.InvalidTokenError = exports.ExpiredTokenError = exports.AccountNotFoundError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class AccountNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.AccountNotFoundError = AccountNotFoundError;
class ExpiredTokenError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.ExpiredTokenError = ExpiredTokenError;
class InvalidTokenError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidTokenError = InvalidTokenError;
class InvalidEmailError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidEmailError = InvalidEmailError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'AccountNotFound')
            return new AccountNotFoundError(e);
        if (e.error === 'ExpiredToken')
            return new ExpiredTokenError(e);
        if (e.error === 'InvalidToken')
            return new InvalidTokenError(e);
        if (e.error === 'InvalidEmail')
            return new InvalidEmailError(e);
    }
    return e;
}
//# sourceMappingURL=confirmEmail.js.map