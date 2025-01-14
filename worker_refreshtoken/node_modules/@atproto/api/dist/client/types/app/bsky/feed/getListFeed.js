"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnknownListError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class UnknownListError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.UnknownListError = UnknownListError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'UnknownList')
            return new UnknownListError(e);
    }
    return e;
}
//# sourceMappingURL=getListFeed.js.map