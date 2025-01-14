"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActorNotFoundError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class ActorNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.ActorNotFoundError = ActorNotFoundError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'ActorNotFound')
            return new ActorNotFoundError(e);
    }
    return e;
}
//# sourceMappingURL=getRelationships.js.map