/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon';
import * as AppBskyEmbedDefs from './defs';
export interface Main {
    video: BlobRef;
    captions?: Caption[];
    /** Alt text description of the video, for accessibility. */
    alt?: string;
    aspectRatio?: AppBskyEmbedDefs.AspectRatio;
    [k: string]: unknown;
}
export declare function isMain(v: unknown): v is Main;
export declare function validateMain(v: unknown): ValidationResult;
export interface Caption {
    lang: string;
    file: BlobRef;
    [k: string]: unknown;
}
export declare function isCaption(v: unknown): v is Caption;
export declare function validateCaption(v: unknown): ValidationResult;
export interface View {
    cid: string;
    playlist: string;
    thumbnail?: string;
    alt?: string;
    aspectRatio?: AppBskyEmbedDefs.AspectRatio;
    [k: string]: unknown;
}
export declare function isView(v: unknown): v is View;
export declare function validateView(v: unknown): ValidationResult;
//# sourceMappingURL=video.d.ts.map