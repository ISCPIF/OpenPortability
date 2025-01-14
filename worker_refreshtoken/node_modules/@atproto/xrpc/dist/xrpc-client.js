"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XrpcClient = void 0;
const lexicon_1 = require("@atproto/lexicon");
const fetch_handler_1 = require("./fetch-handler");
const types_1 = require("./types");
const util_1 = require("./util");
class XrpcClient {
    constructor(fetchHandlerOpts, 
    // "Lexicons" is redundant here (because that class implements
    // "Iterable<LexiconDoc>") but we keep it for explicitness:
    lex) {
        Object.defineProperty(this, "fetchHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "headers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "lex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.fetchHandler = (0, fetch_handler_1.buildFetchHandler)(fetchHandlerOpts);
        this.lex = lex instanceof lexicon_1.Lexicons ? lex : new lexicon_1.Lexicons(lex);
    }
    setHeader(key, value) {
        this.headers.set(key.toLowerCase(), value);
    }
    unsetHeader(key) {
        this.headers.delete(key.toLowerCase());
    }
    clearHeaders() {
        this.headers.clear();
    }
    async call(methodNsid, params, data, opts) {
        const def = this.lex.getDefOrThrow(methodNsid);
        if (!def || (def.type !== 'query' && def.type !== 'procedure')) {
            throw new TypeError(`Invalid lexicon: ${methodNsid}. Must be a query or procedure.`);
        }
        // @TODO: should we validate the params and data here?
        // this.lex.assertValidXrpcParams(methodNsid, params)
        // if (data !== undefined) {
        //   this.lex.assertValidXrpcInput(methodNsid, data)
        // }
        const reqUrl = (0, util_1.constructMethodCallUrl)(methodNsid, def, params);
        const reqMethod = (0, util_1.getMethodSchemaHTTPMethod)(def);
        const reqHeaders = (0, util_1.constructMethodCallHeaders)(def, data, opts);
        const reqBody = (0, util_1.encodeMethodCallBody)(reqHeaders, data);
        // The duplex field is required for streaming bodies, but not yet reflected
        // anywhere in docs or types. See whatwg/fetch#1438, nodejs/node#46221.
        const init = {
            method: reqMethod,
            headers: (0, util_1.combineHeaders)(reqHeaders, this.headers),
            body: reqBody,
            duplex: 'half',
            signal: opts?.signal,
        };
        try {
            const response = await this.fetchHandler.call(undefined, reqUrl, init);
            const resStatus = response.status;
            const resHeaders = Object.fromEntries(response.headers.entries());
            const resBodyBytes = await response.arrayBuffer();
            const resBody = (0, util_1.httpResponseBodyParse)(response.headers.get('content-type'), resBodyBytes);
            const resCode = (0, types_1.httpResponseCodeToEnum)(resStatus);
            if (resCode !== types_1.ResponseType.Success) {
                const { error = undefined, message = undefined } = resBody && (0, util_1.isErrorResponseBody)(resBody) ? resBody : {};
                throw new types_1.XRPCError(resCode, error, message, resHeaders);
            }
            try {
                this.lex.assertValidXrpcOutput(methodNsid, resBody);
            }
            catch (e) {
                if (e instanceof lexicon_1.ValidationError) {
                    throw new types_1.XRPCInvalidResponseError(methodNsid, e, resBody);
                }
                throw e;
            }
            return new types_1.XRPCResponse(resBody, resHeaders);
        }
        catch (err) {
            throw types_1.XRPCError.from(err);
        }
    }
}
exports.XrpcClient = XrpcClient;
//# sourceMappingURL=xrpc-client.js.map