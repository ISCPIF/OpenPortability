"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadQueryStringError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class BadQueryStringError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.BadQueryStringError = BadQueryStringError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'BadQueryString')
            return new BadQueryStringError(e);
    }
    return e;
}
//# sourceMappingURL=searchActorsSkeleton.js.map