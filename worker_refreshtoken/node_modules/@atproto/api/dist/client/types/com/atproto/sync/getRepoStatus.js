"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoNotFoundError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class RepoNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.RepoNotFoundError = RepoNotFoundError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'RepoNotFound')
            return new RepoNotFoundError(e);
    }
    return e;
}
//# sourceMappingURL=getRepoStatus.js.map