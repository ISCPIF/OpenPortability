"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XRPCInvalidResponseError = exports.XRPCError = exports.XRPCResponse = exports.ResponseTypeStrings = exports.ResponseTypeNames = exports.ResponseType = exports.errorResponseBody = void 0;
exports.httpResponseCodeToEnum = httpResponseCodeToEnum;
exports.httpResponseCodeToName = httpResponseCodeToName;
exports.httpResponseCodeToString = httpResponseCodeToString;
const zod_1 = require("zod");
exports.errorResponseBody = zod_1.z.object({
    error: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
var ResponseType;
(function (ResponseType) {
    ResponseType[ResponseType["Unknown"] = 1] = "Unknown";
    ResponseType[ResponseType["InvalidResponse"] = 2] = "InvalidResponse";
    ResponseType[ResponseType["Success"] = 200] = "Success";
    ResponseType[ResponseType["InvalidRequest"] = 400] = "InvalidRequest";
    ResponseType[ResponseType["AuthRequired"] = 401] = "AuthRequired";
    ResponseType[ResponseType["Forbidden"] = 403] = "Forbidden";
    ResponseType[ResponseType["XRPCNotSupported"] = 404] = "XRPCNotSupported";
    ResponseType[ResponseType["NotAcceptable"] = 406] = "NotAcceptable";
    ResponseType[ResponseType["PayloadTooLarge"] = 413] = "PayloadTooLarge";
    ResponseType[ResponseType["UnsupportedMediaType"] = 415] = "UnsupportedMediaType";
    ResponseType[ResponseType["RateLimitExceeded"] = 429] = "RateLimitExceeded";
    ResponseType[ResponseType["InternalServerError"] = 500] = "InternalServerError";
    ResponseType[ResponseType["MethodNotImplemented"] = 501] = "MethodNotImplemented";
    ResponseType[ResponseType["UpstreamFailure"] = 502] = "UpstreamFailure";
    ResponseType[ResponseType["NotEnoughResources"] = 503] = "NotEnoughResources";
    ResponseType[ResponseType["UpstreamTimeout"] = 504] = "UpstreamTimeout";
})(ResponseType || (exports.ResponseType = ResponseType = {}));
function httpResponseCodeToEnum(status) {
    if (status in ResponseType) {
        return status;
    }
    else if (status >= 100 && status < 200) {
        return ResponseType.XRPCNotSupported;
    }
    else if (status >= 200 && status < 300) {
        return ResponseType.Success;
    }
    else if (status >= 300 && status < 400) {
        return ResponseType.XRPCNotSupported;
    }
    else if (status >= 400 && status < 500) {
        return ResponseType.InvalidRequest;
    }
    else {
        return ResponseType.InternalServerError;
    }
}
exports.ResponseTypeNames = {
    [ResponseType.Unknown]: 'Unknown',
    [ResponseType.InvalidResponse]: 'InvalidResponse',
    [ResponseType.Success]: 'Success',
    [ResponseType.InvalidRequest]: 'InvalidRequest',
    [ResponseType.AuthRequired]: 'AuthenticationRequired',
    [ResponseType.Forbidden]: 'Forbidden',
    [ResponseType.XRPCNotSupported]: 'XRPCNotSupported',
    [ResponseType.PayloadTooLarge]: 'PayloadTooLarge',
    [ResponseType.UnsupportedMediaType]: 'UnsupportedMediaType',
    [ResponseType.RateLimitExceeded]: 'RateLimitExceeded',
    [ResponseType.InternalServerError]: 'InternalServerError',
    [ResponseType.MethodNotImplemented]: 'MethodNotImplemented',
    [ResponseType.UpstreamFailure]: 'UpstreamFailure',
    [ResponseType.NotEnoughResources]: 'NotEnoughResources',
    [ResponseType.UpstreamTimeout]: 'UpstreamTimeout',
};
function httpResponseCodeToName(status) {
    return exports.ResponseTypeNames[httpResponseCodeToEnum(status)];
}
exports.ResponseTypeStrings = {
    [ResponseType.Unknown]: 'Unknown',
    [ResponseType.InvalidResponse]: 'Invalid Response',
    [ResponseType.Success]: 'Success',
    [ResponseType.InvalidRequest]: 'Invalid Request',
    [ResponseType.AuthRequired]: 'Authentication Required',
    [ResponseType.Forbidden]: 'Forbidden',
    [ResponseType.XRPCNotSupported]: 'XRPC Not Supported',
    [ResponseType.PayloadTooLarge]: 'Payload Too Large',
    [ResponseType.UnsupportedMediaType]: 'Unsupported Media Type',
    [ResponseType.RateLimitExceeded]: 'Rate Limit Exceeded',
    [ResponseType.InternalServerError]: 'Internal Server Error',
    [ResponseType.MethodNotImplemented]: 'Method Not Implemented',
    [ResponseType.UpstreamFailure]: 'Upstream Failure',
    [ResponseType.NotEnoughResources]: 'Not Enough Resources',
    [ResponseType.UpstreamTimeout]: 'Upstream Timeout',
};
function httpResponseCodeToString(status) {
    return exports.ResponseTypeStrings[httpResponseCodeToEnum(status)];
}
class XRPCResponse {
    constructor(data, headers) {
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: data
        });
        Object.defineProperty(this, "headers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: headers
        });
        Object.defineProperty(this, "success", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
    }
}
exports.XRPCResponse = XRPCResponse;
class XRPCError extends Error {
    constructor(statusCode, error = httpResponseCodeToName(statusCode), message, headers, options) {
        super(message || error || httpResponseCodeToString(statusCode), options);
        Object.defineProperty(this, "error", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: error
        });
        Object.defineProperty(this, "headers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: headers
        });
        Object.defineProperty(this, "success", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.status = httpResponseCodeToEnum(statusCode);
        // Pre 2022 runtimes won't handle the "options" constructor argument
        const cause = options?.cause;
        if (this.cause === undefined && cause !== undefined) {
            this.cause = cause;
        }
    }
    static from(cause, fallbackStatus) {
        if (cause instanceof XRPCError) {
            return cause;
        }
        // Type cast the cause to an Error if it is one
        const causeErr = cause instanceof Error ? cause : undefined;
        // Try and find a Response object in the cause
        const causeResponse = cause instanceof Response
            ? cause
            : cause?.['response'] instanceof Response
                ? cause['response']
                : undefined;
        const statusCode = 
        // Extract status code from "http-errors" like errors
        causeErr?.['statusCode'] ??
            causeErr?.['status'] ??
            // Use the status code from the response object as fallback
            causeResponse?.status;
        // Convert the status code to a ResponseType
        const status = typeof statusCode === 'number'
            ? httpResponseCodeToEnum(statusCode)
            : fallbackStatus ?? ResponseType.Unknown;
        const message = causeErr?.message ?? String(cause);
        const headers = causeResponse
            ? Object.fromEntries(causeResponse.headers.entries())
            : undefined;
        return new XRPCError(status, undefined, message, headers, { cause });
    }
}
exports.XRPCError = XRPCError;
class XRPCInvalidResponseError extends XRPCError {
    constructor(lexiconNsid, validationError, responseBody) {
        super(ResponseType.InvalidResponse, exports.ResponseTypeStrings[ResponseType.InvalidResponse], `The server gave an invalid response and may be out of date.`, undefined, { cause: validationError });
        Object.defineProperty(this, "lexiconNsid", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: lexiconNsid
        });
        Object.defineProperty(this, "validationError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: validationError
        });
        Object.defineProperty(this, "responseBody", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: responseBody
        });
    }
}
exports.XRPCInvalidResponseError = XRPCInvalidResponseError;
//# sourceMappingURL=types.js.map