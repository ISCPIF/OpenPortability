"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberAlreadyExistsError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class MemberAlreadyExistsError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.MemberAlreadyExistsError = MemberAlreadyExistsError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'MemberAlreadyExists')
            return new MemberAlreadyExistsError(e);
    }
    return e;
}
//# sourceMappingURL=addMember.js.map