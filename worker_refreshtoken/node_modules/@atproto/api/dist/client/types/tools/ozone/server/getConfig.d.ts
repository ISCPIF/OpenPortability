/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import { ValidationResult } from '@atproto/lexicon';
export interface QueryParams {
}
export type InputSchema = undefined;
export interface OutputSchema {
    appview?: ServiceConfig;
    pds?: ServiceConfig;
    blobDivert?: ServiceConfig;
    chat?: ServiceConfig;
    viewer?: ViewerConfig;
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
export interface ServiceConfig {
    url?: string;
    [k: string]: unknown;
}
export declare function isServiceConfig(v: unknown): v is ServiceConfig;
export declare function validateServiceConfig(v: unknown): ValidationResult;
export interface ViewerConfig {
    role?: 'tools.ozone.team.defs#roleAdmin' | 'tools.ozone.team.defs#roleModerator' | 'tools.ozone.team.defs#roleTriage' | (string & {});
    [k: string]: unknown;
}
export declare function isViewerConfig(v: unknown): v is ViewerConfig;
export declare function validateViewerConfig(v: unknown): ValidationResult;
//# sourceMappingURL=getConfig.d.ts.map