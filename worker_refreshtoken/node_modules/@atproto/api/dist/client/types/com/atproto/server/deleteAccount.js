"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidTokenError = exports.ExpiredTokenError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
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
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'ExpiredToken')
            return new ExpiredTokenError(e);
        if (e.error === 'InvalidToken')
            return new InvalidTokenError(e);
    }
    return e;
}
//# sourceMappingURL=deleteAccount.js.map