/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as AppBskyEmbedRecord from './record';
import * as AppBskyEmbedImages from './images';
import * as AppBskyEmbedVideo from './video';
import * as AppBskyEmbedExternal from './external';
export interface Main {
    record: AppBskyEmbedRecord.Main;
    media: AppBskyEmbedImages.Main | AppBskyEmbedVideo.Main | AppBskyEmbedExternal.Main | {
        $type: string;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
export declare function isMain(v: unknown): v is Main;
export declare function validateMain(v: unknown): ValidationResult;
export interface View {
    record: AppBskyEmbedRecord.View;
    media: AppBskyEmbedImages.View | AppBskyEmbedVideo.View | AppBskyEmbedExternal.View | {
        $type: string;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
export declare function isView(v: unknown): v is View;
export declare function validateView(v: unknown): ValidationResult;
//# sourceMappingURL=recordWithMedia.d.ts.map