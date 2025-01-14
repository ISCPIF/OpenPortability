import zod from 'zod';
import { Nux } from './client/types/app/bsky/actor/defs';
import { AppBskyActorDefs } from './client';
export declare function sanitizeMutedWordValue(value: string): string;
export declare function savedFeedsToUriArrays(savedFeeds: AppBskyActorDefs.SavedFeed[]): {
    pinned: string[];
    saved: string[];
};
/**
 * Get the type of a saved feed, used by deprecated methods for backwards
 * compat. Should not be used moving forward. *Invalid URIs will throw.*
 *
 * @param uri - The AT URI of the saved feed
 */
export declare function getSavedFeedType(uri: string): AppBskyActorDefs.SavedFeed['type'];
export declare function validateSavedFeed(savedFeed: AppBskyActorDefs.SavedFeed): void;
export type Did = `did:${string}`;
export declare const isDid: (str: unknown) => str is Did;
export declare const asDid: (value: string) => Did;
export declare const nuxSchema: zod.ZodObject<{
    id: zod.ZodString;
    completed: zod.ZodBoolean;
    data: zod.ZodOptional<zod.ZodString>;
    expiresAt: zod.ZodOptional<zod.ZodString>;
}, "strict", zod.ZodTypeAny, {
    id: string;
    completed: boolean;
    expiresAt?: string | undefined;
    data?: string | undefined;
}, {
    id: string;
    completed: boolean;
    expiresAt?: string | undefined;
    data?: string | undefined;
}>;
export declare function validateNux(nux: Nux): void;
//# sourceMappingURL=util.d.ts.map