import { Gettable } from '@atproto/xrpc';
import { Agent } from './agent';
import { ComAtprotoServerCreateAccount, ComAtprotoServerCreateSession, ComAtprotoServerGetSession, ComAtprotoServerNS } from './client';
import { SessionManager } from './session-manager';
import { AtpAgentLoginOpts, AtpPersistSessionHandler, AtpSessionData } from './types';
export type AtpAgentOptions = {
    service: string | URL;
    persistSession?: AtpPersistSessionHandler;
    fetch?: typeof globalThis.fetch;
    headers?: Iterable<[string, Gettable<null | string>]>;
};
/**
 * A wrapper around the {@link Agent} class that uses credential based session
 * management. This class also exposes most of the session management methods
 * directly.
 *
 * This class will be deprecated in the near future. Use {@link Agent} directly
 * with a {@link CredentialSession} instead:
 *
 *  ```ts
 *  const session = new CredentialSession({
 *    service: new URL('https://example.com'),
 *  })
 *
 *  const agent = new Agent(session)
 *  ```
 */
export declare class AtpAgent extends Agent {
    readonly sessionManager: CredentialSession;
    constructor(options: AtpAgentOptions | CredentialSession);
    clone(): AtpAgent;
    get session(): AtpSessionData | undefined;
    get hasSession(): boolean;
    get did(): string | undefined;
    get serviceUrl(): URL;
    get pdsUrl(): URL | undefined;
    get dispatchUrl(): URL;
    /** @deprecated use {@link serviceUrl} instead */
    get service(): URL;
    get persistSession(): unknown;
    set persistSession(v: unknown);
    /** @deprecated use {@link AtpAgent.serviceUrl} instead */
    getServiceUrl(): URL;
    resumeSession(session: AtpSessionData): Promise<ComAtprotoServerGetSession.Response>;
    createAccount(data: ComAtprotoServerCreateAccount.InputSchema, opts?: ComAtprotoServerCreateAccount.CallOptions): Promise<ComAtprotoServerCreateAccount.Response>;
    login(opts: AtpAgentLoginOpts): Promise<ComAtprotoServerCreateSession.Response>;
    logout(): Promise<void>;
}
/**
 * Credentials (username / password) based session manager. Instances of this
 * class will typically be used as the session manager for an {@link AtpAgent}.
 * They can also be used with an {@link XrpcClient}, if you want to use you
 * own Lexicons.
 */
export declare class CredentialSession implements SessionManager {
    readonly serviceUrl: URL;
    fetch: typeof fetch;
    protected readonly persistSession?: AtpPersistSessionHandler | undefined;
    pdsUrl?: URL;
    session?: AtpSessionData;
    refreshSessionPromise: Promise<void> | undefined;
    /**
     * Private {@link ComAtprotoServerNS} used to perform session management API
     * calls on the service endpoint. Calls performed by this agent will not be
     * authenticated using the user's session to allow proper manual configuration
     * of the headers when performing session management operations.
     */
    protected server: ComAtprotoServerNS;
    constructor(serviceUrl: URL, fetch?: typeof globalThis.fetch, persistSession?: AtpPersistSessionHandler | undefined);
    get did(): string | undefined;
    get dispatchUrl(): URL;
    get hasSession(): boolean;
    /**
     * Sets a WhatWG "fetch()" function to be used for making HTTP requests.
     */
    setFetch(fetch?: typeof globalThis.fetch): void;
    fetchHandler(url: string, init?: RequestInit): Promise<Response>;
    /**
     * Create a new account and hydrate its session in this agent.
     */
    createAccount(data: ComAtprotoServerCreateAccount.InputSchema, opts?: ComAtprotoServerCreateAccount.CallOptions): Promise<ComAtprotoServerCreateAccount.Response>;
    /**
     * Start a new session with this agent.
     */
    login(opts: AtpAgentLoginOpts): Promise<ComAtprotoServerCreateSession.Response>;
    logout(): Promise<void>;
    /**
     * Resume a pre-existing session with this agent.
     */
    resumeSession(session: AtpSessionData): Promise<ComAtprotoServerGetSession.Response>;
    /**
     * Internal helper to refresh sessions
     * - Wraps the actual implementation in a promise-guard to ensure only
     *   one refresh is attempted at a time.
     */
    refreshSession(): Promise<void>;
    /**
     * Internal helper to refresh sessions (actual behavior)
     */
    private _refreshSessionInner;
    /**
     * Helper to update the pds endpoint dynamically.
     *
     * The session methods (create, resume, refresh) may respond with the user's
     * did document which contains the user's canonical PDS endpoint. That endpoint
     * may differ from the endpoint used to contact the server. We capture that
     * PDS endpoint and update the client to use that given endpoint for future
     * requests. (This helps ensure smooth migrations between PDSes, especially
     * when the PDSes are operated by a single org.)
     */
    private _updateApiEndpoint;
}
//# sourceMappingURL=atp-agent.d.ts.map