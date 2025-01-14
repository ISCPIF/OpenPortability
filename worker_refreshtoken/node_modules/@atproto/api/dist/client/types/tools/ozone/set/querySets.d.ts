/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneSetDefs from './defs';
export interface QueryParams {
    limit?: number;
    cursor?: string;
    namePrefix?: string;
    sortBy?: 'name' | 'createdAt' | 'updatedAt';
    /** Defaults to ascending order of name field. */
    sortDirection?: 'asc' | 'desc';
}
export type InputSchema = undefined;
export interface OutputSchema {
    sets: ToolsOzoneSetDefs.SetView[];
    cursor?: string;
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
//# sourceMappingURL=querySets.d.ts.map