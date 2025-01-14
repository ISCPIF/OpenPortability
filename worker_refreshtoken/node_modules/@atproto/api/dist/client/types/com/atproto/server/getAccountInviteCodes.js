"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateCreateError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class DuplicateCreateError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.DuplicateCreateError = DuplicateCreateError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'DuplicateCreate')
            return new DuplicateCreateError(e);
    }
    return e;
}
//# sourceMappingURL=getAccountInviteCodes.js.map