/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap } from '@atproto/xrpc';
import * as ComAtprotoModerationDefs from './defs';
import * as ComAtprotoAdminDefs from '../admin/defs';
import * as ComAtprotoRepoStrongRef from '../repo/strongRef';
export interface QueryParams {
}
export interface InputSchema {
    reasonType: ComAtprotoModerationDefs.ReasonType;
    /** Additional context about the content and violation. */
    reason?: string;
    subject: ComAtprotoAdminDefs.RepoRef | ComAtprotoRepoStrongRef.Main | {
        $type: string;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
export interface OutputSchema {
    id: number;
    reasonType: ComAtprotoModerationDefs.ReasonType;
    reason?: string;
    subject: ComAtprotoAdminDefs.RepoRef | ComAtprotoRepoStrongRef.Main | {
        $type: string;
        [k: string]: unknown;
    };
    reportedBy: string;
    createdAt: string;
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
//# sourceMappingURL=createReport.d.ts.map