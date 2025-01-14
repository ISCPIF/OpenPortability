import { LexXrpcProcedure, LexXrpcQuery } from '@atproto/lexicon';
import { CallOptions, ErrorResponseBody, Gettable, QueryParams } from './types';
export declare function isErrorResponseBody(v: unknown): v is ErrorResponseBody;
export declare function getMethodSchemaHTTPMethod(schema: LexXrpcProcedure | LexXrpcQuery): "post" | "get";
export declare function constructMethodCallUri(nsid: string, schema: LexXrpcProcedure | LexXrpcQuery, serviceUri: URL, params?: QueryParams): string;
export declare function constructMethodCallUrl(nsid: string, schema: LexXrpcProcedure | LexXrpcQuery, params?: QueryParams): string;
export declare function encodeQueryParam(type: 'string' | 'float' | 'integer' | 'boolean' | 'datetime' | 'array' | 'unknown', value: any): string;
export declare function constructMethodCallHeaders(schema: LexXrpcProcedure | LexXrpcQuery, data?: unknown, opts?: CallOptions): Headers;
export declare function combineHeaders(headersInit: undefined | HeadersInit, defaultHeaders?: Iterable<[string, undefined | Gettable<null | string>]>): undefined | HeadersInit;
export declare function isBodyInit(value: unknown): value is BodyInit;
export declare function isIterable(value: unknown): value is Iterable<unknown> | AsyncIterable<unknown>;
export declare function encodeMethodCallBody(headers: Headers, data?: unknown): BodyInit | undefined;
export declare function httpResponseBodyParse(mimeType: string | null, data: ArrayBuffer | undefined): any;
//# sourceMappingURL=util.d.ts.map