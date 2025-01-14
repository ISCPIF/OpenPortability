/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as ToolsOzoneCommunicationDefs from './defs';
export interface QueryParams {
}
export interface InputSchema {
    /** Name of the template. */
    name: string;
    /** Content of the template, markdown supported, can contain variable placeholders. */
    contentMarkdown: string;
    /** Subject of the message, used in emails. */
    subject: string;
    /** Message language. */
    lang?: string;
    /** DID of the user who is creating the template. */
    createdBy?: string;
    [k: string]: unknown;
}
export type OutputSchema = ToolsOzoneCommunicationDefs.TemplateView;
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
    qp?: QueryParams;
    encoding?: 'application/json';
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare class DuplicateTemplateNameError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=createTemplate.d.ts.map