/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon';
/** A representation of some externally linked content (eg, a URL and 'card'), embedded in a Bluesky record (eg, a post). */
export interface Main {
    external: External;
    [k: string]: unknown;
}
export declare function isMain(v: unknown): v is Main;
export declare function validateMain(v: unknown): ValidationResult;
export interface External {
    uri: string;
    title: string;
    description: string;
    thumb?: BlobRef;
    [k: string]: unknown;
}
export declare function isExternal(v: unknown): v is External;
export declare function validateExternal(v: unknown): ValidationResult;
export interface View {
    external: ViewExternal;
    [k: string]: unknown;
}
export declare function isView(v: unknown): v is View;
export declare function validateView(v: unknown): ValidationResult;
export interface ViewExternal {
    uri: string;
    title: string;
    description: string;
    thumb?: string;
    [k: string]: unknown;
}
export declare function isViewExternal(v: unknown): v is ViewExternal;
export declare function validateViewExternal(v: unknown): ValidationResult;
//# sourceMappingURL=external.d.ts.map