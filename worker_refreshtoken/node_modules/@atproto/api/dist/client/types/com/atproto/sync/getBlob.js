"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoDeactivatedError = exports.RepoSuspendedError = exports.RepoTakendownError = exports.RepoNotFoundError = exports.BlobNotFoundError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class BlobNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.BlobNotFoundError = BlobNotFoundError;
class RepoNotFoundError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.RepoNotFoundError = RepoNotFoundError;
class RepoTakendownError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.RepoTakendownError = RepoTakendownError;
class RepoSuspendedError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.RepoSuspendedError = RepoSuspendedError;
class RepoDeactivatedError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.RepoDeactivatedError = RepoDeactivatedError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'BlobNotFound')
            return new BlobNotFoundError(e);
        if (e.error === 'RepoNotFound')
            return new RepoNotFoundError(e);
        if (e.error === 'RepoTakendown')
            return new RepoTakendownError(e);
        if (e.error === 'RepoSuspended')
            return new RepoSuspendedError(e);
        if (e.error === 'RepoDeactivated')
            return new RepoDeactivatedError(e);
    }
    return e;
}
//# sourceMappingURL=getBlob.js.map