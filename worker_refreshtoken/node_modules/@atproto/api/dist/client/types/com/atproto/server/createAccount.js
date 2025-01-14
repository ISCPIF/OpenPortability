"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncompatibleDidDocError = exports.UnresolvableDidError = exports.UnsupportedDomainError = exports.HandleNotAvailableError = exports.InvalidInviteCodeError = exports.InvalidPasswordError = exports.InvalidHandleError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class InvalidHandleError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidHandleError = InvalidHandleError;
class InvalidPasswordError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidPasswordError = InvalidPasswordError;
class InvalidInviteCodeError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.InvalidInviteCodeError = InvalidInviteCodeError;
class HandleNotAvailableError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.HandleNotAvailableError = HandleNotAvailableError;
class UnsupportedDomainError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.UnsupportedDomainError = UnsupportedDomainError;
class UnresolvableDidError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.UnresolvableDidError = UnresolvableDidError;
class IncompatibleDidDocError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.IncompatibleDidDocError = IncompatibleDidDocError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'InvalidHandle')
            return new InvalidHandleError(e);
        if (e.error === 'InvalidPassword')
            return new InvalidPasswordError(e);
        if (e.error === 'InvalidInviteCode')
            return new InvalidInviteCodeError(e);
        if (e.error === 'HandleNotAvailable')
            return new HandleNotAvailableError(e);
        if (e.error === 'UnsupportedDomain')
            return new UnsupportedDomainError(e);
        if (e.error === 'UnresolvableDid')
            return new UnresolvableDidError(e);
        if (e.error === 'IncompatibleDidDoc')
            return new IncompatibleDidDocError(e);
    }
    return e;
}
//# sourceMappingURL=createAccount.js.map