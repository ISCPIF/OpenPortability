"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadExpirationError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class BadExpirationError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.BadExpirationError = BadExpirationError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'BadExpiration')
            return new BadExpirationError(e);
    }
    return e;
}
//# sourceMappingURL=getServiceAuth.js.map