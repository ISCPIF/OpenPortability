/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc';
import * as ToolsOzoneModerationDefs from './defs';
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs';
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef';
export interface QueryParams {
}
export interface InputSchema {
    event: ToolsOzoneModerationDefs.ModEventTakedown | ToolsOzoneModerationDefs.ModEventAcknowledge | ToolsOzoneModerationDefs.ModEventEscalate | ToolsOzoneModerationDefs.ModEventComment | ToolsOzoneModerationDefs.ModEventLabel | ToolsOzoneModerationDefs.ModEventReport | ToolsOzoneModerationDefs.ModEventMute | ToolsOzoneModerationDefs.ModEventUnmute | ToolsOzoneModerationDefs.ModEventMuteReporter | ToolsOzoneModerationDefs.ModEventUnmuteReporter | ToolsOzoneModerationDefs.ModEventReverseTakedown | ToolsOzoneModerationDefs.ModEventResolveAppeal | ToolsOzoneModerationDefs.ModEventEmail | ToolsOzoneModerationDefs.ModEventTag | ToolsOzoneModerationDefs.AccountEvent | ToolsOzoneModerationDefs.IdentityEvent | ToolsOzoneModerationDefs.RecordEvent | {
        $type: string;
        [k: string]: unknown;
    };
    subject: ComAtprotoAdminDefs.RepoRef | ComAtprotoRepoStrongRef.Main | {
        $type: string;
        [k: string]: unknown;
    };
    subjectBlobCids?: string[];
    createdBy: string;
    [k: string]: unknown;
}
export type OutputSchema = ToolsOzoneModerationDefs.ModEventView;
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
export declare class SubjectHasActionError extends XRPCError {
    constructor(src: XRPCError);
}
export declare function toKnownErr(e: any): any;
//# sourceMappingURL=emitEvent.d.ts.map