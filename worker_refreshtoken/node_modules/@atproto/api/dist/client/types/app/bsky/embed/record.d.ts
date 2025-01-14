/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef';
import * as AppBskyFeedDefs from '../feed/defs';
import * as AppBskyGraphDefs from '../graph/defs';
import * as AppBskyLabelerDefs from '../labeler/defs';
import * as AppBskyActorDefs from '../actor/defs';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
import * as AppBskyEmbedImages from './images';
import * as AppBskyEmbedVideo from './video';
import * as AppBskyEmbedExternal from './external';
import * as AppBskyEmbedRecordWithMedia from './recordWithMedia';
export interface Main {
    record: ComAtprotoRepoStrongRef.Main;
    [k: string]: unknown;
}
export declare function isMain(v: unknown): v is Main;
export declare function validateMain(v: unknown): ValidationResult;
export interface View {
    record: ViewRecord | ViewNotFound | ViewBlocked | ViewDetached | AppBskyFeedDefs.GeneratorView | AppBskyGraphDefs.ListView | AppBskyLabelerDefs.LabelerView | AppBskyGraphDefs.StarterPackViewBasic | {
        $type: string;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
export declare function isView(v: unknown): v is View;
export declare function validateView(v: unknown): ValidationResult;
export interface ViewRecord {
    uri: string;
    cid: string;
    author: AppBskyActorDefs.ProfileViewBasic;
    /** The record data itself. */
    value: {};
    labels?: ComAtprotoLabelDefs.Label[];
    replyCount?: number;
    repostCount?: number;
    likeCount?: number;
    quoteCount?: number;
    embeds?: (AppBskyEmbedImages.View | AppBskyEmbedVideo.View | AppBskyEmbedExternal.View | View | AppBskyEmbedRecordWithMedia.View | {
        $type: string;
        [k: string]: unknown;
    })[];
    indexedAt: string;
    [k: string]: unknown;
}
export declare function isViewRecord(v: unknown): v is ViewRecord;
export declare function validateViewRecord(v: unknown): ValidationResult;
export interface ViewNotFound {
    uri: string;
    notFound: true;
    [k: string]: unknown;
}
export declare function isViewNotFound(v: unknown): v is ViewNotFound;
export declare function validateViewNotFound(v: unknown): ValidationResult;
export interface ViewBlocked {
    uri: string;
    blocked: true;
    author: AppBskyFeedDefs.BlockedAuthor;
    [k: string]: unknown;
}
export declare function isViewBlocked(v: unknown): v is ViewBlocked;
export declare function validateViewBlocked(v: unknown): ValidationResult;
export interface ViewDetached {
    uri: string;
    detached: true;
    [k: string]: unknown;
}
export declare function isViewDetached(v: unknown): v is ViewDetached;
export declare function validateViewDetached(v: unknown): ValidationResult;
//# sourceMappingURL=record.d.ts.map