/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon';
export interface JobStatus {
    jobId: string;
    did: string;
    /** The state of the video processing job. All values not listed as a known value indicate that the job is in process. */
    state: 'JOB_STATE_COMPLETED' | 'JOB_STATE_FAILED' | (string & {});
    /** Progress within the current processing state. */
    progress?: number;
    blob?: BlobRef;
    error?: string;
    message?: string;
    [k: string]: unknown;
}
export declare function isJobStatus(v: unknown): v is JobStatus;
export declare function validateJobStatus(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map