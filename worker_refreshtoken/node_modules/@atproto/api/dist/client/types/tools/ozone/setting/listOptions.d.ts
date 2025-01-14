/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneSettingDefs from './defs';
export interface QueryParams {
    limit?: number;
    cursor?: string;
    scope?: 'instance' | 'personal' | (string & {});
    /** Filter keys by prefix */
    prefix?: string;
    /** Filter for only the specified keys. Ignored if prefix is provided */
    keys?: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
    cursor?: string;
    options: ToolsOzoneSettingDefs.Option[];
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
//# sourceMappingURL=listOptions.d.ts.map