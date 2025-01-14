/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ComAtprotoAdminDefs from './defs';
import * as ComAtprotoRepoStrongRef from '../repo/strongRef';
export interface QueryParams {
    did?: string;
    uri?: string;
    blob?: string;
}
export type InputSchema = undefined;
export interface OutputSchema {
    subject: ComAtprotoAdminDefs.RepoRef | ComAtprotoRepoStrongRef.Main | ComAtprotoAdminDefs.RepoBlobRef | {
        $type: string;
        [k: string]: unknown;
    };
    takedown?: ComAtprotoAdminDefs.StatusAttr;
    deactivated?: ComAtprotoAdminDefs.StatusAttr;
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
//# sourceMappingURL=getSubjectStatus.d.ts.map