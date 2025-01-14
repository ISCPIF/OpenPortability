/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ToolsOzoneSettingDefs from './defs';
export interface QueryParams {
}
export interface InputSchema {
    key: string;
    scope: 'instance' | 'personal' | (string & {});
    value: {};
    description?: string;
    managerRole?: 'tools.ozone.team.defs#roleModerator' | 'tools.ozone.team.defs#roleTriage' | 'tools.ozone.team.defs#roleAdmin' | (string & {});
    [k: string]: unknown;
}
export interface OutputSchema {
    option: ToolsOzoneSettingDefs.Option;
    [k: string]: unknown;
}
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
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=upsertOption.d.ts.map