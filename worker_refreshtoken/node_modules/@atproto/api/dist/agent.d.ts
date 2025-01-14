import { FetchHandler, XrpcClient } from '@atproto/xrpc';
import { AppBskyActorDefs, AppBskyActorProfile, AppBskyFeedPost, AppNS, ChatNS, ComNS, ToolsNS } from './client/index';
import { MutedWord, Nux } from './client/types/app/bsky/actor/defs';
import { InterpretedLabelValueDefinition, LabelPreference, ModerationPrefs } from './moderation/types';
import { SessionManager } from './session-manager';
import { AtpAgentGlobalOpts, AtprotoServiceType, BskyFeedViewPreference, BskyInterestsPreference, BskyPreferences, BskyThreadViewPreference } from './types';
import { Did } from './util';
declare global {
    interface Array<T> {
        findLast(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T;
    }
}
export type { FetchHandler };
/**
 * An {@link Agent} is an {@link AtpBaseClient} with the following
 * additional features:
 * - AT Protocol labelers configuration utilities
 * - AT Protocol proxy configuration utilities
 * - Cloning utilities
 * - `app.bsky` syntactic sugar
 * - `com.atproto` syntactic sugar
 */
export declare class Agent extends XrpcClient {
    #private;
    /**
     * The labelers to be used across all requests with the takedown capability
     */
    static appLabelers: readonly string[];
    /**
     * Configures the Agent (or its sub classes) globally.
     */
    static configure(opts: AtpAgentGlobalOpts): void;
    com: ComNS;
    app: AppNS;
    chat: ChatNS;
    tools: ToolsNS;
    /** @deprecated use `this` instead */
    get xrpc(): XrpcClient;
    readonly sessionManager: SessionManager;
    constructor(options: string | URL | SessionManager);
    clone(): Agent;
    copyInto<T extends Agent>(inst: T): T;
    withProxy(serviceType: AtprotoServiceType, did: string): ReturnType<this["clone"]>;
    /**
     * The labelers statically configured on the class of the current instance.
     */
    get appLabelers(): readonly string[];
    labelers: readonly string[];
    configureLabelers(labelerDids: readonly string[]): void;
    /** @deprecated use {@link configureLabelers} instead */
    configureLabelersHeader(labelerDids: readonly string[]): void;
    proxy?: `${Did}#${AtprotoServiceType}`;
    configureProxy(value: `${Did}#${AtprotoServiceType}` | null): void;
    /** @deprecated use {@link configureProxy} instead */
    configureProxyHeader(serviceType: AtprotoServiceType, did: string): void;
    /**
     * Get the authenticated user's DID, if any.
     */
    get did(): string | undefined;
    /** @deprecated Use {@link Agent.assertDid} instead */
    get accountDid(): string;
    /**
     * Get the authenticated user's DID, or throw an error if not authenticated.
     */
    get assertDid(): string;
    /**
     * Assert that the user is authenticated.
     */
    assertAuthenticated(): asserts this is {
        did: string;
    };
    /** @deprecated use "this" instead */
    get api(): this;
    /**
     * Upload a binary blob to the server
     */
    uploadBlob: typeof this.com.atproto.repo.uploadBlob;
    /**
     * Resolve a handle to a DID
     */
    resolveHandle: typeof this.com.atproto.identity.resolveHandle;
    /**
     * Change the user's handle
     */
    updateHandle: typeof this.com.atproto.identity.updateHandle;
    /**
     * Create a moderation report
     */
    createModerationReport: typeof this.com.atproto.moderation.createReport;
    getTimeline: typeof this.app.bsky.feed.getTimeline;
    getAuthorFeed: typeof this.app.bsky.feed.getAuthorFeed;
    getActorLikes: typeof this.app.bsky.feed.getActorLikes;
    getPostThread: typeof this.app.bsky.feed.getPostThread;
    getPost: typeof this.app.bsky.feed.post.get;
    getPosts: typeof this.app.bsky.feed.getPosts;
    getLikes: typeof this.app.bsky.feed.getLikes;
    getRepostedBy: typeof this.app.bsky.feed.getRepostedBy;
    getFollows: typeof this.app.bsky.graph.getFollows;
    getFollowers: typeof this.app.bsky.graph.getFollowers;
    getProfile: typeof this.app.bsky.actor.getProfile;
    getProfiles: typeof this.app.bsky.actor.getProfiles;
    getSuggestions: typeof this.app.bsky.actor.getSuggestions;
    searchActors: typeof this.app.bsky.actor.searchActors;
    searchActorsTypeahead: typeof this.app.bsky.actor.searchActorsTypeahead;
    listNotifications: typeof this.app.bsky.notification.listNotifications;
    countUnreadNotifications: typeof this.app.bsky.notification.getUnreadCount;
    getLabelers: typeof this.app.bsky.labeler.getServices;
    getLabelDefinitions(prefs: BskyPreferences | ModerationPrefs | string[]): Promise<Record<string, InterpretedLabelValueDefinition[]>>;
    post(record: Partial<AppBskyFeedPost.Record> & Omit<AppBskyFeedPost.Record, 'createdAt'>): Promise<{
        uri: string;
        cid: string;
    }>;
    deletePost(postUri: string): Promise<void>;
    like(uri: string, cid: string): Promise<{
        uri: string;
        cid: string;
    }>;
    deleteLike(likeUri: string): Promise<void>;
    repost(uri: string, cid: string): Promise<{
        uri: string;
        cid: string;
    }>;
    deleteRepost(repostUri: string): Promise<void>;
    follow(subjectDid: string): Promise<{
        uri: string;
        cid: string;
    }>;
    deleteFollow(followUri: string): Promise<void>;
    upsertProfile(updateFn: (existing: AppBskyActorProfile.Record | undefined) => AppBskyActorProfile.Record | Promise<AppBskyActorProfile.Record>): Promise<void>;
    mute(actor: string): Promise<import("./client/types/app/bsky/graph/muteActor").Response>;
    unmute(actor: string): Promise<import("./client/types/app/bsky/graph/unmuteActor").Response>;
    muteModList(uri: string): Promise<import("./client/types/app/bsky/graph/muteActorList").Response>;
    unmuteModList(uri: string): Promise<import("./client/types/app/bsky/graph/unmuteActorList").Response>;
    blockModList(uri: string): Promise<{
        uri: string;
        cid: string;
    }>;
    unblockModList(uri: string): Promise<void>;
    updateSeenNotifications(seenAt?: string): Promise<import("./client/types/app/bsky/notification/updateSeen").Response>;
    getPreferences(): Promise<BskyPreferences>;
    overwriteSavedFeeds(savedFeeds: AppBskyActorDefs.SavedFeed[]): Promise<AppBskyActorDefs.SavedFeed[]>;
    updateSavedFeeds(savedFeedsToUpdate: AppBskyActorDefs.SavedFeed[]): Promise<AppBskyActorDefs.SavedFeed[]>;
    addSavedFeeds(savedFeeds: Pick<AppBskyActorDefs.SavedFeed, 'type' | 'value' | 'pinned'>[]): Promise<AppBskyActorDefs.SavedFeed[]>;
    removeSavedFeeds(ids: string[]): Promise<AppBskyActorDefs.SavedFeed[]>;
    /**
     * @deprecated use `overwriteSavedFeeds`
     */
    setSavedFeeds(saved: string[], pinned: string[]): Promise<{
        saved: string[];
        pinned: string[];
    }>;
    /**
     * @deprecated use `addSavedFeeds`
     */
    addSavedFeed(v: string): Promise<{
        saved: string[];
        pinned: string[];
    }>;
    /**
     * @deprecated use `removeSavedFeeds`
     */
    removeSavedFeed(v: string): Promise<{
        saved: string[];
        pinned: string[];
    }>;
    /**
     * @deprecated use `addSavedFeeds` or `updateSavedFeeds`
     */
    addPinnedFeed(v: string): Promise<{
        saved: string[];
        pinned: string[];
    }>;
    /**
     * @deprecated use `updateSavedFeeds` or `removeSavedFeeds`
     */
    removePinnedFeed(v: string): Promise<{
        saved: string[];
        pinned: string[];
    }>;
    setAdultContentEnabled(v: boolean): Promise<void>;
    setContentLabelPref(key: string, value: LabelPreference, labelerDid?: string): Promise<void>;
    addLabeler(did: string): Promise<void>;
    removeLabeler(did: string): Promise<void>;
    setPersonalDetails({ birthDate, }: {
        birthDate: string | Date | undefined;
    }): Promise<void>;
    setFeedViewPrefs(feed: string, pref: Partial<BskyFeedViewPreference>): Promise<void>;
    setThreadViewPrefs(pref: Partial<BskyThreadViewPreference>): Promise<void>;
    setInterestsPref(pref: Partial<BskyInterestsPreference>): Promise<void>;
    /**
     * Add a muted word to user preferences.
     */
    addMutedWord(mutedWord: Pick<MutedWord, 'value' | 'targets' | 'actorTarget' | 'expiresAt'>): Promise<void>;
    /**
     * Convenience method to add muted words to user preferences
     */
    addMutedWords(newMutedWords: AppBskyActorDefs.MutedWord[]): Promise<void>;
    /**
     * @deprecated use `addMutedWords` or `addMutedWord` instead
     */
    upsertMutedWords(mutedWords: Pick<MutedWord, 'value' | 'targets' | 'actorTarget' | 'expiresAt'>[]): Promise<void>;
    /**
     * Update a muted word in user preferences.
     */
    updateMutedWord(mutedWord: AppBskyActorDefs.MutedWord): Promise<void>;
    /**
     * Remove a muted word from user preferences.
     */
    removeMutedWord(mutedWord: AppBskyActorDefs.MutedWord): Promise<void>;
    /**
     * Convenience method to remove muted words from user preferences
     */
    removeMutedWords(mutedWords: AppBskyActorDefs.MutedWord[]): Promise<void>;
    hidePost(postUri: string): Promise<void>;
    unhidePost(postUri: string): Promise<void>;
    bskyAppQueueNudges(nudges: string | string[]): Promise<void>;
    bskyAppDismissNudges(nudges: string | string[]): Promise<void>;
    bskyAppSetActiveProgressGuide(guide: AppBskyActorDefs.BskyAppProgressGuide | undefined): Promise<void>;
    /**
     * Insert or update a NUX in user prefs
     */
    bskyAppUpsertNux(nux: Nux): Promise<void>;
    /**
     * Removes NUXs from user preferences.
     */
    bskyAppRemoveNuxs(ids: string[]): Promise<void>;
    /**
     * This function updates the preferences of a user and allows for a callback function to be executed
     * before the update.
     * @param cb - cb is a callback function that takes in a single parameter of type
     * AppBskyActorDefs.Preferences and returns either a boolean or void. This callback function is used to
     * update the preferences of the user. The function is called with the current preferences as an
     * argument and if the callback returns false, the preferences are not updated.
     */
    private updatePreferences;
    private updateHiddenPost;
    /**
     * A helper specifically for updating feed preferences
     */
    private updateFeedPreferences;
    private updateSavedFeedsV2Preferences;
}
//# sourceMappingURL=agent.d.ts.map