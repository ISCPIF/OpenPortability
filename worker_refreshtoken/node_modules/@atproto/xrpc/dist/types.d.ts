import { z } from 'zod';
import { ValidationError } from '@atproto/lexicon';
export type QueryParams = Record<string, any>;
export type HeadersMap = Record<string, string>;
export type { 
/** @deprecated not to be confused with the WHATWG Headers constructor */
HeadersMap as Headers, };
export type Gettable<T> = T | (() => T);
export interface CallOptions {
    encoding?: string;
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export declare const errorResponseBody: z.ZodObject<{
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    error?: string | undefined;
    message?: string | undefined;
}, {
    error?: string | undefined;
    message?: string | undefined;
}>;
export type ErrorResponseBody = z.infer<typeof errorResponseBody>;
export declare enum ResponseType {
    Unknown = 1,
    InvalidResponse = 2,
    Success = 200,
    InvalidRequest = 400,
    AuthRequired = 401,
    Forbidden = 403,
    XRPCNotSupported = 404,
    NotAcceptable = 406,
    PayloadTooLarge = 413,
    UnsupportedMediaType = 415,
    RateLimitExceeded = 429,
    InternalServerError = 500,
    MethodNotImplemented = 501,
    UpstreamFailure = 502,
    NotEnoughResources = 503,
    UpstreamTimeout = 504
}
export declare function httpResponseCodeToEnum(status: number): ResponseType;
export declare const ResponseTypeNames: {
    1: string;
    2: string;
    200: string;
    400: string;
    401: string;
    403: string;
    404: string;
    413: string;
    415: string;
    429: string;
    500: string;
    501: string;
    502: string;
    503: string;
    504: string;
};
export declare function httpResponseCodeToName(status: number): string;
export declare const ResponseTypeStrings: {
    1: string;
    2: string;
    200: string;
    400: string;
    401: string;
    403: string;
    404: string;
    413: string;
    415: string;
    429: string;
    500: string;
    501: string;
    502: string;
    503: string;
    504: string;
};
export declare function httpResponseCodeToString(status: number): string;
export declare class XRPCResponse {
    data: any;
    headers: HeadersMap;
    success: boolean;
    constructor(data: any, headers: HeadersMap);
}
export declare class XRPCError extends Error {
    error: string;
    headers?: HeadersMap | undefined;
    success: boolean;
    status: ResponseType;
    constructor(statusCode: number, error?: string, message?: string, headers?: HeadersMap | undefined, options?: ErrorOptions);
    static from(cause: unknown, fallbackStatus?: ResponseType): XRPCError;
}
export declare class XRPCInvalidResponseError extends XRPCError {
    lexiconNsid: string;
    validationError: ValidationError;
    responseBody: unknown;
    constructor(lexiconNsid: string, validationError: ValidationError, responseBody: unknown);
}
//# sourceMappingURL=types.d.ts.map