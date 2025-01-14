import { LexiconDoc, Lexicons } from '@atproto/lexicon';
import { CallOptions, QueryParams } from './types';
import { XrpcClient } from './xrpc-client';
/** @deprecated Use {@link XrpcClient} instead */
export declare class Client {
    /** @deprecated */
    get fetch(): never;
    /** @deprecated */
    set fetch(_: never);
    lex: Lexicons;
    call(serviceUri: string | URL, methodNsid: string, params?: QueryParams, data?: BodyInit | null, opts?: CallOptions): Promise<import("./types").XRPCResponse>;
    service(serviceUri: string | URL): ServiceClient;
    addLexicon(doc: LexiconDoc): void;
    addLexicons(docs: LexiconDoc[]): void;
    removeLexicon(uri: string): void;
}
/** @deprecated Use {@link XrpcClient} instead */
export declare class ServiceClient extends XrpcClient {
    baseClient: Client;
    uri: URL;
    constructor(baseClient: Client, serviceUri: string | URL);
}
//# sourceMappingURL=client.d.ts.map