"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidSwapError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class InvalidSwapError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidSwapError = InvalidSwapError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'InvalidSwap')
            return new InvalidSwapError(e);
    }
    return e;
}
//# sourceMappingURL=putRecord.js.map