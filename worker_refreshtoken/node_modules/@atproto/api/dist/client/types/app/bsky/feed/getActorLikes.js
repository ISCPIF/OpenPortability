"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockedByActorError = exports.BlockedActorError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class BlockedActorError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.BlockedActorError = BlockedActorError;
class BlockedByActorError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.BlockedByActorError = BlockedByActorError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'BlockedActor')
            return new BlockedActorError(e);
        if (e.error === 'BlockedByActor')
            return new BlockedByActorError(e);
    }
    return e;
}
//# sourceMappingURL=getActorLikes.js.map