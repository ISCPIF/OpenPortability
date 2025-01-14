/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneModerationDefs from './defs';
export interface QueryParams {
    uris: string[];
}
export type InputSchema = undefined;
export interface OutputSchema {
    records: (ToolsOzoneModerationDefs.RecordViewDetail | ToolsOzoneModerationDefs.RecordViewNotFound | {
        $type: string;
        [k: string]: unknown;
    })[];
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
//# sourceMappingURL=getRecords.d.ts.map