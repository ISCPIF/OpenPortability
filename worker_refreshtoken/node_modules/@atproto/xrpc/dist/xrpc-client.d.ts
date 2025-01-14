import { LexiconDoc, Lexicons } from '@atproto/lexicon';
import { FetchHandler, FetchHandlerObject, FetchHandlerOptions } from './fetch-handler';
import { CallOptions, Gettable, QueryParams, XRPCResponse } from './types';
export declare class XrpcClient {
    readonly fetchHandler: FetchHandler;
    readonly headers: Map<string, Gettable<string | null>>;
    readonly lex: Lexicons;
    constructor(fetchHandlerOpts: FetchHandler | FetchHandlerObject | FetchHandlerOptions, lex: Lexicons | Iterable<LexiconDoc>);
    setHeader(key: string, value: Gettable<null | string>): void;
    unsetHeader(key: string): void;
    clearHeaders(): void;
    call(methodNsid: string, params?: QueryParams, data?: unknown, opts?: CallOptions): Promise<XRPCResponse>;
}
//# sourceMappingURL=xrpc-client.d.ts.map