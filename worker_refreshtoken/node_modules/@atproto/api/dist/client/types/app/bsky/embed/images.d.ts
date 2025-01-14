/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon';
import * as AppBskyEmbedDefs from './defs';
export interface Main {
    images: Image[];
    [k: string]: unknown;
}
export declare function isMain(v: unknown): v is Main;
export declare function validateMain(v: unknown): ValidationResult;
export interface Image {
    image: BlobRef;
    /** Alt text description of the image, for accessibility. */
    alt: string;
    aspectRatio?: AppBskyEmbedDefs.AspectRatio;
    [k: string]: unknown;
}
export declare function isImage(v: unknown): v is Image;
export declare function validateImage(v: unknown): ValidationResult;
export interface View {
    images: ViewImage[];
    [k: string]: unknown;
}
export declare function isView(v: unknown): v is View;
export declare function validateView(v: unknown): ValidationResult;
export interface ViewImage {
    /** Fully-qualified URL where a thumbnail of the image can be fetched. For example, CDN location provided by the App View. */
    thumb: string;
    /** Fully-qualified URL where a large version of the image can be fetched. May or may not be the exact original blob. For example, CDN location provided by the App View. */
    fullsize: string;
    /** Alt text description of the image, for accessibility. */
    alt: string;
    aspectRatio?: AppBskyEmbedDefs.AspectRatio;
    [k: string]: unknown;
}
export declare function isViewImage(v: unknown): v is ViewImage;
export declare function validateViewImage(v: unknown): ValidationResult;
//# sourceMappingURL=images.d.ts.map