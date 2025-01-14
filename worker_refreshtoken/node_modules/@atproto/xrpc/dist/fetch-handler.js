"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFetchHandler = buildFetchHandler;
const util_1 = require("./util");
function buildFetchHandler(options) {
    // Already a fetch handler (allowed for convenience)
    if (typeof options === 'function')
        return options;
    if (typeof options === 'object' && 'fetchHandler' in options) {
        return options.fetchHandler.bind(options);
    }
    const { service, headers: defaultHeaders = undefined, fetch = globalThis.fetch, } = typeof options === 'string' || options instanceof URL
        ? { service: options }
        : options;
    if (typeof fetch !== 'function') {
        throw new TypeError('XrpcDispatcher requires fetch() to be available in your environment.');
    }
    const defaultHeadersEntries = defaultHeaders != null ? Object.entries(defaultHeaders) : undefined;
    return async function (url, init) {
        const base = typeof service === 'function' ? service() : service;
        const fullUrl = new URL(url, base);
        const headers = (0, util_1.combineHeaders)(init.headers, defaultHeadersEntries);
        return fetch(fullUrl, { ...init, headers });
    };
}
//# sourceMappingURL=fetch-handler.js.map