import { ValidationResult } from '@atproto/lexicon';
import { CID } from 'multiformats/cid';
/** Represents an update of repository state. Note that empty commits are allowed, which include no repo data changes, but an update to rev and signature. */
export interface Commit {
    /** The stream sequence number of this message. */
    seq: number;
    /** DEPRECATED -- unused */
    rebase: boolean;
    /** Indicates that this commit contained too many ops, or data size was too large. Consumers will need to make a separate request to get missing data. */
    tooBig: boolean;
    /** The repo this event comes from. */
    repo: string;
    /** Repo commit object CID. */
    commit: CID;
    /** DEPRECATED -- unused. WARNING -- nullable and optional; stick with optional to ensure golang interoperability. */
    prev?: CID | null;
    /** The rev of the emitted commit. Note that this information is also in the commit object included in blocks, unless this is a tooBig event. */
    rev: string;
    /** The rev of the last emitted commit from this repo (if any). */
    since: string | null;
    /** CAR file containing relevant blocks, as a diff since the previous repo state. */
    blocks: Uint8Array;
    ops: RepoOp[];
    blobs: CID[];
    /** Timestamp of when this message was originally broadcast. */
    time: string;
    [k: string]: unknown;
}
export declare function isCommit(v: unknown): v is Commit;
export declare function validateCommit(v: unknown): ValidationResult;
/** Represents a change to an account's identity. Could be an updated handle, signing key, or pds hosting endpoint. Serves as a prod to all downstream services to refresh their identity cache. */
export interface Identity {
    seq: number;
    did: string;
    time: string;
    /** The current handle for the account, or 'handle.invalid' if validation fails. This field is optional, might have been validated or passed-through from an upstream source. Semantics and behaviors for PDS vs Relay may evolve in the future; see atproto specs for more details. */
    handle?: string;
    [k: string]: unknown;
}
export declare function isIdentity(v: unknown): v is Identity;
export declare function validateIdentity(v: unknown): ValidationResult;
/** Represents a change to an account's status on a host (eg, PDS or Relay). The semantics of this event are that the status is at the host which emitted the event, not necessarily that at the currently active PDS. Eg, a Relay takedown would emit a takedown with active=false, even if the PDS is still active. */
export interface Account {
    seq: number;
    did: string;
    time: string;
    /** Indicates that the account has a repository which can be fetched from the host that emitted this event. */
    active: boolean;
    /** If active=false, this optional field indicates a reason for why the account is not active. */
    status?: 'takendown' | 'suspended' | 'deleted' | 'deactivated' | (string & {});
    [k: string]: unknown;
}
export declare function isAccount(v: unknown): v is Account;
export declare function validateAccount(v: unknown): ValidationResult;
/** DEPRECATED -- Use #identity event instead */
export interface Handle {
    seq: number;
    did: string;
    handle: string;
    time: string;
    [k: string]: unknown;
}
export declare function isHandle(v: unknown): v is Handle;
export declare function validateHandle(v: unknown): ValidationResult;
/** DEPRECATED -- Use #account event instead */
export interface Migrate {
    seq: number;
    did: string;
    migrateTo: string | null;
    time: string;
    [k: string]: unknown;
}
export declare function isMigrate(v: unknown): v is Migrate;
export declare function validateMigrate(v: unknown): ValidationResult;
/** DEPRECATED -- Use #account event instead */
export interface Tombstone {
    seq: number;
    did: string;
    time: string;
    [k: string]: unknown;
}
export declare function isTombstone(v: unknown): v is Tombstone;
export declare function validateTombstone(v: unknown): ValidationResult;
export interface Info {
    name: 'OutdatedCursor' | (string & {});
    message?: string;
    [k: string]: unknown;
}
export declare function isInfo(v: unknown): v is Info;
export declare function validateInfo(v: unknown): ValidationResult;
/** A repo operation, ie a mutation of a single record. */
export interface RepoOp {
    action: 'create' | 'update' | 'delete' | (string & {});
    path: string;
    /** For creates and updates, the new record CID. For deletions, null. */
    cid: CID | null;
    [k: string]: unknown;
}
export declare function isRepoOp(v: unknown): v is RepoOp;
export declare function validateRepoOp(v: unknown): ValidationResult;
//# sourceMappingURL=subscribeRepos.d.ts.map