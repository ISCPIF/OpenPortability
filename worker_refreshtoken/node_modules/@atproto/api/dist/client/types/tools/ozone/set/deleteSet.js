"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetNotFoundError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class SetNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.SetNotFoundError = SetNotFoundError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'SetNotFound')
            return new SetNotFoundError(e);
    }
    return e;
}
//# sourceMappingURL=deleteSet.js.map