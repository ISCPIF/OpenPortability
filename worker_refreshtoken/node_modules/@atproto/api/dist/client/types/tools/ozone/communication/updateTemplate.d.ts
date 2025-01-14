/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as ToolsOzoneCommunicationDefs from './defs';
export interface QueryParams {
}
export interface InputSchema {
    /** ID of the template to be updated. */
    id: string;
    /** Name of the template. */
    name?: string;
    /** Message language. */
    lang?: string;
    /** Content of the template, markdown supported, can contain variable placeholders. */
    contentMarkdown?: string;
    /** Subject of the message, used in emails. */
    subject?: string;
    /** DID of the user who is updating the template. */
    updatedBy?: string;
    disabled?: boolean;
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
//# sourceMappingURL=updateTemplate.d.ts.map