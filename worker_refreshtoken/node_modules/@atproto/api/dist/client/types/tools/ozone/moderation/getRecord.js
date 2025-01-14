"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordNotFoundError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class RecordNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.RecordNotFoundError = RecordNotFoundError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'RecordNotFound')
            return new RecordNotFoundError(e);
    }
    return e;
}
//# sourceMappingURL=getRecord.js.map