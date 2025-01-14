/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneCommunicationDefs from './defs';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    communicationTemplates: ToolsOzoneCommunicationDefs.TemplateView[];
    [k: string]: unknown;
}
export interface CallOptions {
    signal?: AbortSignal;
    headers?: HeadersMap;
}
export interface Response {
    success: boolean;
    headers: HeadersMap;
    data: OutputSchema;
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=listTemplates.d.ts.map