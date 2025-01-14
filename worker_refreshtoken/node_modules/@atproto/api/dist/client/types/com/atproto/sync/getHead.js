"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadNotFoundError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class HeadNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.HeadNotFoundError = HeadNotFoundError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'HeadNotFound')
            return new HeadNotFoundError(e);
    }
    return e;
}
//# sourceMappingURL=getHead.js.map