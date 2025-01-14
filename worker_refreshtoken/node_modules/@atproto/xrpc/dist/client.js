"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceClient = exports.Client = void 0;
const lexicon_1 = require("@atproto/lexicon");
const xrpc_client_1 = require("./xrpc-client");
const util_1 = require("./util");
/** @deprecated Use {@link XrpcClient} instead */
class Client {
    constructor() {
        Object.defineProperty(this, "lex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new lexicon_1.Lexicons()
        });
    }
    /** @deprecated */
    get fetch() {
        throw new Error('Client.fetch is no longer supported. Use an XrpcClient instead.');
    }
    /** @deprecated */
    set fetch(_) {
        throw new Error('Client.fetch is no longer supported. Use an XrpcClient instead.');
    }
    // method calls
    //
    async call(serviceUri, methodNsid, params, data, opts) {
        return this.service(serviceUri).call(methodNsid, params, data, opts);
    }
    service(serviceUri) {
        return new ServiceClient(this, serviceUri);
    }
    // schemas
    // =
    addLexicon(doc) {
        this.lex.add(doc);
    }
    addLexicons(docs) {
        for (const doc of docs) {
            this.addLexicon(doc);
        }
    }
    removeLexicon(uri) {
        this.lex.remove(uri);
    }
}
exports.Client = Client;
/** @deprecated Use {@link XrpcClient} instead */
class ServiceClient extends xrpc_client_1.XrpcClient {
    constructor(baseClient, serviceUri) {
        super(async (input, init) => {
            const headers = (0, util_1.combineHeaders)(init.headers, Object.entries(this.headers));
            return fetch(new URL(input, this.uri), { ...init, headers });
        }, baseClient.lex);
        Object.defineProperty(this, "baseClient", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: baseClient
        });
        Object.defineProperty(this, "uri", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.uri = typeof serviceUri === 'string' ? new URL(serviceUri) : serviceUri;
    }
}
exports.ServiceClient = ServiceClient;
//# sourceMappingURL=client.js.map