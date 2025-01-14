"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectHasActionError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class SubjectHasActionError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.SubjectHasActionError = SubjectHasActionError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'SubjectHasAction')
            return new SubjectHasActionError(e);
    }
    return e;
}
//# sourceMappingURL=emitEvent.js.map