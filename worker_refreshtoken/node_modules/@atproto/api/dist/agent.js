"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Agent_prefsLock;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const common_web_1 = require("@atproto/common-web");
const syntax_1 = require("@atproto/syntax");
const xrpc_1 = require("@atproto/xrpc");
const await_lock_1 = __importDefault(require("await-lock"));
const index_1 = require("./client/index");
const lexicons_1 = require("./client/lexicons");
const const_1 = require("./const");
const moderation_1 = require("./moderation");
const labels_1 = require("./moderation/const/labels");
const util_1 = require("./util");
const FEED_VIEW_PREF_DEFAULTS = {
    hideReplies: false,
    hideRepliesByUnfollowed: true,
    hideRepliesByLikeCount: 0,
    hideReposts: false,
    hideQuotePosts: false,
};
const THREAD_VIEW_PREF_DEFAULTS = {
    sort: 'hotness',
    prioritizeFollowedUsers: true,
};
/**
 * An {@link Agent} is an {@link AtpBaseClient} with the following
 * additional features:
 * - AT Protocol labelers configuration utilities
 * - AT Protocol proxy configuration utilities
 * - Cloning utilities
 * - `app.bsky` syntactic sugar
 * - `com.atproto` syntactic sugar
 */
class Agent extends xrpc_1.XrpcClient {
    /**
     * Configures the Agent (or its sub classes) globally.
     */
    static configure(opts) {
        if (opts.appLabelers) {
            this.appLabelers = opts.appLabelers.map(util_1.asDid); // Validate & copy
        }
    }
    /** @deprecated use `this` instead */
    get xrpc() {
        return this;
    }
    constructor(options) {
        const sessionManager = typeof options === 'string' || options instanceof URL
            ? {
                did: undefined,
                fetchHandler: (0, xrpc_1.buildFetchHandler)(options),
            }
            : options;
        super((url, init) => {
            const headers = new Headers(init?.headers);
            if (this.proxy && !headers.has('atproto-proxy')) {
                headers.set('atproto-proxy', this.proxy);
            }
            // Merge the labelers header of this particular request with the app &
            // instance labelers.
            headers.set('atproto-accept-labelers', [
                ...this.appLabelers.map((l) => `${l};redact`),
                ...this.labelers,
                headers.get('atproto-accept-labelers')?.trim(),
            ]
                .filter(Boolean)
                .join(', '));
            return this.sessionManager.fetchHandler(url, { ...init, headers });
        }, lexicons_1.schemas);
        //#endregion
        Object.defineProperty(this, "com", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new index_1.ComNS(this)
        });
        Object.defineProperty(this, "app", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new index_1.AppNS(this)
        });
        Object.defineProperty(this, "chat", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new index_1.ChatNS(this)
        });
        Object.defineProperty(this, "tools", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new index_1.ToolsNS(this)
        });
        Object.defineProperty(this, "sessionManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "labelers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        //#endregion
        //#region ATPROTO proxy configuration utilities
        Object.defineProperty(this, "proxy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        //#region "com.atproto" lexicon short hand methods
        /**
         * Upload a binary blob to the server
         */
        Object.defineProperty(this, "uploadBlob", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (data, opts) => this.com.atproto.repo.uploadBlob(data, opts)
        });
        /**
         * Resolve a handle to a DID
         */
        Object.defineProperty(this, "resolveHandle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.com.atproto.identity.resolveHandle(params, opts)
        });
        /**
         * Change the user's handle
         */
        Object.defineProperty(this, "updateHandle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (data, opts) => this.com.atproto.identity.updateHandle(data, opts)
        });
        /**
         * Create a moderation report
         */
        Object.defineProperty(this, "createModerationReport", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (data, opts) => this.com.atproto.moderation.createReport(data, opts)
        });
        //#endregion
        //#region "app.bsky" lexicon short hand methods
        Object.defineProperty(this, "getTimeline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.feed.getTimeline(params, opts)
        });
        Object.defineProperty(this, "getAuthorFeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.feed.getAuthorFeed(params, opts)
        });
        Object.defineProperty(this, "getActorLikes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.feed.getActorLikes(params, opts)
        });
        Object.defineProperty(this, "getPostThread", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.feed.getPostThread(params, opts)
        });
        Object.defineProperty(this, "getPost", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params) => this.app.bsky.feed.post.get(params)
        });
        Object.defineProperty(this, "getPosts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.feed.getPosts(params, opts)
        });
        Object.defineProperty(this, "getLikes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.feed.getLikes(params, opts)
        });
        Object.defineProperty(this, "getRepostedBy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.feed.getRepostedBy(params, opts)
        });
        Object.defineProperty(this, "getFollows", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.graph.getFollows(params, opts)
        });
        Object.defineProperty(this, "getFollowers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.graph.getFollowers(params, opts)
        });
        Object.defineProperty(this, "getProfile", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.actor.getProfile(params, opts)
        });
        Object.defineProperty(this, "getProfiles", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.actor.getProfiles(params, opts)
        });
        Object.defineProperty(this, "getSuggestions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.actor.getSuggestions(params, opts)
        });
        Object.defineProperty(this, "searchActors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.actor.searchActors(params, opts)
        });
        Object.defineProperty(this, "searchActorsTypeahead", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.actor.searchActorsTypeahead(params, opts)
        });
        Object.defineProperty(this, "listNotifications", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.notification.listNotifications(params, opts)
        });
        Object.defineProperty(this, "countUnreadNotifications", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.notification.getUnreadCount(params, opts)
        });
        Object.defineProperty(this, "getLabelers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (params, opts) => this.app.bsky.labeler.getServices(params, opts)
        });
        //- Private methods
        _Agent_prefsLock.set(this, new await_lock_1.default()
        /**
         * This function updates the preferences of a user and allows for a callback function to be executed
         * before the update.
         * @param cb - cb is a callback function that takes in a single parameter of type
         * AppBskyActorDefs.Preferences and returns either a boolean or void. This callback function is used to
         * update the preferences of the user. The function is called with the current preferences as an
         * argument and if the callback returns false, the preferences are not updated.
         */
        );
        this.sessionManager = sessionManager;
    }
    //#region Cloning utilities
    clone() {
        return this.copyInto(new Agent(this.sessionManager));
    }
    copyInto(inst) {
        inst.configureLabelers(this.labelers);
        inst.configureProxy(this.proxy ?? null);
        inst.clearHeaders();
        for (const [key, value] of this.headers)
            inst.setHeader(key, value);
        return inst;
    }
    withProxy(serviceType, did) {
        const inst = this.clone();
        inst.configureProxy(`${(0, util_1.asDid)(did)}#${serviceType}`);
        return inst;
    }
    //#endregion
    //#region ATPROTO labelers configuration utilities
    /**
     * The labelers statically configured on the class of the current instance.
     */
    get appLabelers() {
        return this.constructor.appLabelers;
    }
    configureLabelers(labelerDids) {
        this.labelers = labelerDids.map(util_1.asDid); // Validate & copy
    }
    /** @deprecated use {@link configureLabelers} instead */
    configureLabelersHeader(labelerDids) {
        // Filtering non-did values for backwards compatibility
        this.configureLabelers(labelerDids.filter(util_1.isDid));
    }
    configureProxy(value) {
        if (value === null)
            this.proxy = undefined;
        else if ((0, util_1.isDid)(value))
            this.proxy = value;
        else
            throw new TypeError('Invalid proxy DID');
    }
    /** @deprecated use {@link configureProxy} instead */
    configureProxyHeader(serviceType, did) {
        // Ignoring non-did values for backwards compatibility
        if ((0, util_1.isDid)(did))
            this.configureProxy(`${did}#${serviceType}`);
    }
    //#endregion
    //#region Session management
    /**
     * Get the authenticated user's DID, if any.
     */
    get did() {
        return this.sessionManager.did;
    }
    /** @deprecated Use {@link Agent.assertDid} instead */
    get accountDid() {
        return this.assertDid;
    }
    /**
     * Get the authenticated user's DID, or throw an error if not authenticated.
     */
    get assertDid() {
        this.assertAuthenticated();
        return this.did;
    }
    /**
     * Assert that the user is authenticated.
     */
    assertAuthenticated() {
        if (!this.did)
            throw new Error('Not logged in');
    }
    //#endregion
    /** @deprecated use "this" instead */
    get api() {
        return this;
    }
    async getLabelDefinitions(prefs) {
        // collect the labeler dids
        const dids = [...this.appLabelers];
        if (isBskyPrefs(prefs)) {
            dids.push(...prefs.moderationPrefs.labelers.map((l) => l.did));
        }
        else if (isModPrefs(prefs)) {
            dids.push(...prefs.labelers.map((l) => l.did));
        }
        else {
            dids.push(...prefs);
        }
        // fetch their definitions
        const labelers = await this.getLabelers({
            dids,
            detailed: true,
        });
        // assemble a map of labeler dids to the interpreted label value definitions
        const labelDefs = {};
        if (labelers.data) {
            for (const labeler of labelers.data
                .views) {
                labelDefs[labeler.creator.did] = (0, moderation_1.interpretLabelValueDefinitions)(labeler);
            }
        }
        return labelDefs;
    }
    async post(record) {
        record.createdAt || (record.createdAt = new Date().toISOString());
        return this.app.bsky.feed.post.create({ repo: this.accountDid }, record);
    }
    async deletePost(postUri) {
        this.assertAuthenticated();
        const postUrip = new syntax_1.AtUri(postUri);
        return this.app.bsky.feed.post.delete({
            repo: postUrip.hostname,
            rkey: postUrip.rkey,
        });
    }
    async like(uri, cid) {
        return this.app.bsky.feed.like.create({ repo: this.accountDid }, {
            subject: { uri, cid },
            createdAt: new Date().toISOString(),
        });
    }
    async deleteLike(likeUri) {
        this.assertAuthenticated();
        const likeUrip = new syntax_1.AtUri(likeUri);
        return this.app.bsky.feed.like.delete({
            repo: likeUrip.hostname,
            rkey: likeUrip.rkey,
        });
    }
    async repost(uri, cid) {
        return this.app.bsky.feed.repost.create({ repo: this.accountDid }, {
            subject: { uri, cid },
            createdAt: new Date().toISOString(),
        });
    }
    async deleteRepost(repostUri) {
        this.assertAuthenticated();
        const repostUrip = new syntax_1.AtUri(repostUri);
        return this.app.bsky.feed.repost.delete({
            repo: repostUrip.hostname,
            rkey: repostUrip.rkey,
        });
    }
    async follow(subjectDid) {
        return this.app.bsky.graph.follow.create({ repo: this.accountDid }, {
            subject: subjectDid,
            createdAt: new Date().toISOString(),
        });
    }
    async deleteFollow(followUri) {
        this.assertAuthenticated();
        const followUrip = new syntax_1.AtUri(followUri);
        return this.app.bsky.graph.follow.delete({
            repo: followUrip.hostname,
            rkey: followUrip.rkey,
        });
    }
    async upsertProfile(updateFn) {
        const repo = this.accountDid;
        let retriesRemaining = 5;
        while (retriesRemaining >= 0) {
            // fetch existing
            const existing = await this.com.atproto.repo
                .getRecord({
                repo,
                collection: 'app.bsky.actor.profile',
                rkey: 'self',
            })
                .catch((_) => undefined);
            // run the update
            const updated = await updateFn(existing?.data.value);
            if (updated) {
                updated.$type = 'app.bsky.actor.profile';
            }
            // validate the record
            const validation = index_1.AppBskyActorProfile.validateRecord(updated);
            if (!validation.success) {
                throw validation.error;
            }
            try {
                // attempt the put
                await this.com.atproto.repo.putRecord({
                    repo,
                    collection: 'app.bsky.actor.profile',
                    rkey: 'self',
                    record: updated,
                    swapRecord: existing?.data.cid || null,
                });
            }
            catch (e) {
                if (retriesRemaining > 0 &&
                    e instanceof index_1.ComAtprotoRepoPutRecord.InvalidSwapError) {
                    // try again
                    retriesRemaining--;
                    continue;
                }
                else {
                    throw e;
                }
            }
            break;
        }
    }
    async mute(actor) {
        return this.app.bsky.graph.muteActor({ actor });
    }
    async unmute(actor) {
        return this.app.bsky.graph.unmuteActor({ actor });
    }
    async muteModList(uri) {
        return this.app.bsky.graph.muteActorList({ list: uri });
    }
    async unmuteModList(uri) {
        return this.app.bsky.graph.unmuteActorList({ list: uri });
    }
    async blockModList(uri) {
        return this.app.bsky.graph.listblock.create({ repo: this.accountDid }, {
            subject: uri,
            createdAt: new Date().toISOString(),
        });
    }
    async unblockModList(uri) {
        const repo = this.accountDid;
        const listInfo = await this.app.bsky.graph.getList({
            list: uri,
            limit: 1,
        });
        const blocked = listInfo.data.list.viewer?.blocked;
        if (blocked) {
            const { rkey } = new syntax_1.AtUri(blocked);
            return this.app.bsky.graph.listblock.delete({
                repo,
                rkey,
            });
        }
    }
    async updateSeenNotifications(seenAt = new Date().toISOString()) {
        return this.app.bsky.notification.updateSeen({ seenAt });
    }
    async getPreferences() {
        const prefs = {
            feeds: {
                saved: undefined,
                pinned: undefined,
            },
            // @ts-ignore populating below
            savedFeeds: undefined,
            feedViewPrefs: {
                home: {
                    ...FEED_VIEW_PREF_DEFAULTS,
                },
            },
            threadViewPrefs: { ...THREAD_VIEW_PREF_DEFAULTS },
            moderationPrefs: {
                adultContentEnabled: false,
                labels: { ...labels_1.DEFAULT_LABEL_SETTINGS },
                labelers: this.appLabelers.map((did) => ({
                    did,
                    labels: {},
                })),
                mutedWords: [],
                hiddenPosts: [],
            },
            birthDate: undefined,
            interests: {
                tags: [],
            },
            bskyAppState: {
                queuedNudges: [],
                activeProgressGuide: undefined,
                nuxs: [],
            },
        };
        const res = await this.app.bsky.actor.getPreferences({});
        const labelPrefs = [];
        for (const pref of res.data.preferences) {
            if (index_1.AppBskyActorDefs.isAdultContentPref(pref) &&
                index_1.AppBskyActorDefs.validateAdultContentPref(pref).success) {
                // adult content preferences
                prefs.moderationPrefs.adultContentEnabled = pref.enabled;
            }
            else if (index_1.AppBskyActorDefs.isContentLabelPref(pref) &&
                index_1.AppBskyActorDefs.validateContentLabelPref(pref).success) {
                // content label preference
                const adjustedPref = adjustLegacyContentLabelPref(pref);
                labelPrefs.push(adjustedPref);
            }
            else if (index_1.AppBskyActorDefs.isLabelersPref(pref) &&
                index_1.AppBskyActorDefs.validateLabelersPref(pref).success) {
                // labelers preferences
                prefs.moderationPrefs.labelers = this.appLabelers
                    .map((did) => ({ did, labels: {} }))
                    .concat(pref.labelers.map((labeler) => ({
                    ...labeler,
                    labels: {},
                })));
            }
            else if (index_1.AppBskyActorDefs.isSavedFeedsPrefV2(pref) &&
                index_1.AppBskyActorDefs.validateSavedFeedsPrefV2(pref).success) {
                prefs.savedFeeds = pref.items;
            }
            else if (index_1.AppBskyActorDefs.isSavedFeedsPref(pref) &&
                index_1.AppBskyActorDefs.validateSavedFeedsPref(pref).success) {
                // saved and pinned feeds
                prefs.feeds.saved = pref.saved;
                prefs.feeds.pinned = pref.pinned;
            }
            else if (index_1.AppBskyActorDefs.isPersonalDetailsPref(pref) &&
                index_1.AppBskyActorDefs.validatePersonalDetailsPref(pref).success) {
                // birth date (irl)
                if (pref.birthDate) {
                    prefs.birthDate = new Date(pref.birthDate);
                }
            }
            else if (index_1.AppBskyActorDefs.isFeedViewPref(pref) &&
                index_1.AppBskyActorDefs.validateFeedViewPref(pref).success) {
                // feed view preferences
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { $type, feed, ...v } = pref;
                prefs.feedViewPrefs[pref.feed] = { ...FEED_VIEW_PREF_DEFAULTS, ...v };
            }
            else if (index_1.AppBskyActorDefs.isThreadViewPref(pref) &&
                index_1.AppBskyActorDefs.validateThreadViewPref(pref).success) {
                // thread view preferences
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { $type, ...v } = pref;
                prefs.threadViewPrefs = { ...prefs.threadViewPrefs, ...v };
            }
            else if (index_1.AppBskyActorDefs.isInterestsPref(pref) &&
                index_1.AppBskyActorDefs.validateInterestsPref(pref).success) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { $type, ...v } = pref;
                prefs.interests = { ...prefs.interests, ...v };
            }
            else if (index_1.AppBskyActorDefs.isMutedWordsPref(pref) &&
                index_1.AppBskyActorDefs.validateMutedWordsPref(pref).success) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { $type, ...v } = pref;
                prefs.moderationPrefs.mutedWords = v.items;
                if (prefs.moderationPrefs.mutedWords.length) {
                    prefs.moderationPrefs.mutedWords =
                        prefs.moderationPrefs.mutedWords.map((word) => {
                            word.actorTarget = word.actorTarget || 'all';
                            return word;
                        });
                }
            }
            else if (index_1.AppBskyActorDefs.isHiddenPostsPref(pref) &&
                index_1.AppBskyActorDefs.validateHiddenPostsPref(pref).success) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { $type, ...v } = pref;
                prefs.moderationPrefs.hiddenPosts = v.items;
            }
            else if (index_1.AppBskyActorDefs.isBskyAppStatePref(pref) &&
                index_1.AppBskyActorDefs.validateBskyAppStatePref(pref).success) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { $type, ...v } = pref;
                prefs.bskyAppState.queuedNudges = v.queuedNudges || [];
                prefs.bskyAppState.activeProgressGuide = v.activeProgressGuide;
                prefs.bskyAppState.nuxs = v.nuxs || [];
            }
        }
        /*
         * If `prefs.savedFeeds` is undefined, no `savedFeedsPrefV2` exists, which
         * means we want to try to migrate if needed.
         *
         * If v1 prefs exist, they will be migrated to v2.
         *
         * If no v1 prefs exist, the user is either new, or could be old and has
         * never edited their feeds.
         */
        if (prefs.savedFeeds == null) {
            const { saved, pinned } = prefs.feeds;
            if (saved && pinned) {
                const uniqueMigratedSavedFeeds = new Map();
                // insert Following feed first
                uniqueMigratedSavedFeeds.set('timeline', {
                    id: common_web_1.TID.nextStr(),
                    type: 'timeline',
                    value: 'following',
                    pinned: true,
                });
                // use pinned as source of truth for feed order
                for (const uri of pinned) {
                    const type = (0, util_1.getSavedFeedType)(uri);
                    // only want supported types
                    if (type === 'unknown')
                        continue;
                    uniqueMigratedSavedFeeds.set(uri, {
                        id: common_web_1.TID.nextStr(),
                        type,
                        value: uri,
                        pinned: true,
                    });
                }
                for (const uri of saved) {
                    if (!uniqueMigratedSavedFeeds.has(uri)) {
                        const type = (0, util_1.getSavedFeedType)(uri);
                        // only want supported types
                        if (type === 'unknown')
                            continue;
                        uniqueMigratedSavedFeeds.set(uri, {
                            id: common_web_1.TID.nextStr(),
                            type,
                            value: uri,
                            pinned: false,
                        });
                    }
                }
                prefs.savedFeeds = Array.from(uniqueMigratedSavedFeeds.values());
            }
            else {
                prefs.savedFeeds = [
                    {
                        id: common_web_1.TID.nextStr(),
                        type: 'timeline',
                        value: 'following',
                        pinned: true,
                    },
                ];
            }
            // save to user preferences so this migration doesn't re-occur
            await this.overwriteSavedFeeds(prefs.savedFeeds);
        }
        // apply the label prefs
        for (const pref of labelPrefs) {
            if (pref.labelerDid) {
                const labeler = prefs.moderationPrefs.labelers.find((labeler) => labeler.did === pref.labelerDid);
                if (!labeler)
                    continue;
                labeler.labels[pref.label] = pref.visibility;
            }
            else {
                prefs.moderationPrefs.labels[pref.label] =
                    pref.visibility;
            }
        }
        prefs.moderationPrefs.labels = remapLegacyLabels(prefs.moderationPrefs.labels);
        // automatically configure the client
        this.configureLabelers(prefsArrayToLabelerDids(res.data.preferences));
        return prefs;
    }
    async overwriteSavedFeeds(savedFeeds) {
        savedFeeds.forEach(util_1.validateSavedFeed);
        const uniqueSavedFeeds = new Map();
        savedFeeds.forEach((feed) => {
            // remove and re-insert to preserve order
            if (uniqueSavedFeeds.has(feed.id)) {
                uniqueSavedFeeds.delete(feed.id);
            }
            uniqueSavedFeeds.set(feed.id, feed);
        });
        return this.updateSavedFeedsV2Preferences(() => Array.from(uniqueSavedFeeds.values()));
    }
    async updateSavedFeeds(savedFeedsToUpdate) {
        savedFeedsToUpdate.map(util_1.validateSavedFeed);
        return this.updateSavedFeedsV2Preferences((savedFeeds) => {
            return savedFeeds.map((savedFeed) => {
                const updatedVersion = savedFeedsToUpdate.find((updated) => savedFeed.id === updated.id);
                if (updatedVersion) {
                    return {
                        ...savedFeed,
                        // only update pinned
                        pinned: updatedVersion.pinned,
                    };
                }
                return savedFeed;
            });
        });
    }
    async addSavedFeeds(savedFeeds) {
        const toSave = savedFeeds.map((f) => ({
            ...f,
            id: common_web_1.TID.nextStr(),
        }));
        toSave.forEach(util_1.validateSavedFeed);
        return this.updateSavedFeedsV2Preferences((savedFeeds) => [
            ...savedFeeds,
            ...toSave,
        ]);
    }
    async removeSavedFeeds(ids) {
        return this.updateSavedFeedsV2Preferences((savedFeeds) => [
            ...savedFeeds.filter((feed) => !ids.find((id) => feed.id === id)),
        ]);
    }
    /**
     * @deprecated use `overwriteSavedFeeds`
     */
    async setSavedFeeds(saved, pinned) {
        return this.updateFeedPreferences(() => ({
            saved,
            pinned,
        }));
    }
    /**
     * @deprecated use `addSavedFeeds`
     */
    async addSavedFeed(v) {
        return this.updateFeedPreferences((saved, pinned) => ({
            saved: [...saved.filter((uri) => uri !== v), v],
            pinned,
        }));
    }
    /**
     * @deprecated use `removeSavedFeeds`
     */
    async removeSavedFeed(v) {
        return this.updateFeedPreferences((saved, pinned) => ({
            saved: saved.filter((uri) => uri !== v),
            pinned: pinned.filter((uri) => uri !== v),
        }));
    }
    /**
     * @deprecated use `addSavedFeeds` or `updateSavedFeeds`
     */
    async addPinnedFeed(v) {
        return this.updateFeedPreferences((saved, pinned) => ({
            saved: [...saved.filter((uri) => uri !== v), v],
            pinned: [...pinned.filter((uri) => uri !== v), v],
        }));
    }
    /**
     * @deprecated use `updateSavedFeeds` or `removeSavedFeeds`
     */
    async removePinnedFeed(v) {
        return this.updateFeedPreferences((saved, pinned) => ({
            saved,
            pinned: pinned.filter((uri) => uri !== v),
        }));
    }
    async setAdultContentEnabled(v) {
        await this.updatePreferences((prefs) => {
            let adultContentPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isAdultContentPref(pref) &&
                index_1.AppBskyActorDefs.validateAdultContentPref(pref).success);
            if (adultContentPref) {
                adultContentPref.enabled = v;
            }
            else {
                adultContentPref = {
                    $type: 'app.bsky.actor.defs#adultContentPref',
                    enabled: v,
                };
            }
            return prefs
                .filter((pref) => !index_1.AppBskyActorDefs.isAdultContentPref(pref))
                .concat([adultContentPref]);
        });
    }
    async setContentLabelPref(key, value, labelerDid) {
        if (labelerDid) {
            (0, syntax_1.ensureValidDid)(labelerDid);
        }
        await this.updatePreferences((prefs) => {
            let labelPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isContentLabelPref(pref) &&
                index_1.AppBskyActorDefs.validateContentLabelPref(pref).success &&
                pref.label === key &&
                pref.labelerDid === labelerDid);
            let legacyLabelPref;
            if (labelPref) {
                labelPref.visibility = value;
            }
            else {
                labelPref = {
                    $type: 'app.bsky.actor.defs#contentLabelPref',
                    label: key,
                    labelerDid,
                    visibility: value,
                };
            }
            if (index_1.AppBskyActorDefs.isContentLabelPref(labelPref)) {
                // is global
                if (!labelPref.labelerDid) {
                    const legacyLabelValue = {
                        'graphic-media': 'gore',
                        porn: 'nsfw',
                        sexual: 'suggestive',
                    }[labelPref.label];
                    // if it's a legacy label, double-write the legacy label
                    if (legacyLabelValue) {
                        legacyLabelPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isContentLabelPref(pref) &&
                            index_1.AppBskyActorDefs.validateContentLabelPref(pref).success &&
                            pref.label === legacyLabelValue &&
                            pref.labelerDid === undefined);
                        if (legacyLabelPref) {
                            legacyLabelPref.visibility = value;
                        }
                        else {
                            legacyLabelPref = {
                                $type: 'app.bsky.actor.defs#contentLabelPref',
                                label: legacyLabelValue,
                                labelerDid: undefined,
                                visibility: value,
                            };
                        }
                    }
                }
            }
            return prefs
                .filter((pref) => !index_1.AppBskyActorDefs.isContentLabelPref(pref) ||
                !(pref.label === key && pref.labelerDid === labelerDid))
                .concat([labelPref])
                .filter((pref) => {
                if (!legacyLabelPref)
                    return true;
                return (!index_1.AppBskyActorDefs.isContentLabelPref(pref) ||
                    !(pref.label === legacyLabelPref.label &&
                        pref.labelerDid === undefined));
            })
                .concat(legacyLabelPref ? [legacyLabelPref] : []);
        });
    }
    async addLabeler(did) {
        const prefs = await this.updatePreferences((prefs) => {
            let labelersPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isLabelersPref(pref) &&
                index_1.AppBskyActorDefs.validateLabelersPref(pref).success);
            if (!labelersPref) {
                labelersPref = {
                    $type: 'app.bsky.actor.defs#labelersPref',
                    labelers: [],
                };
            }
            if (index_1.AppBskyActorDefs.isLabelersPref(labelersPref)) {
                let labelerPrefItem = labelersPref.labelers.find((labeler) => labeler.did === did);
                if (!labelerPrefItem) {
                    labelerPrefItem = {
                        did,
                    };
                    labelersPref.labelers.push(labelerPrefItem);
                }
            }
            return prefs
                .filter((pref) => !index_1.AppBskyActorDefs.isLabelersPref(pref))
                .concat([labelersPref]);
        });
        // automatically configure the client
        this.configureLabelers(prefsArrayToLabelerDids(prefs));
    }
    async removeLabeler(did) {
        const prefs = await this.updatePreferences((prefs) => {
            let labelersPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isLabelersPref(pref) &&
                index_1.AppBskyActorDefs.validateLabelersPref(pref).success);
            if (!labelersPref) {
                labelersPref = {
                    $type: 'app.bsky.actor.defs#labelersPref',
                    labelers: [],
                };
            }
            if (index_1.AppBskyActorDefs.isLabelersPref(labelersPref)) {
                labelersPref.labelers = labelersPref.labelers.filter((labeler) => labeler.did !== did);
            }
            return prefs
                .filter((pref) => !index_1.AppBskyActorDefs.isLabelersPref(pref))
                .concat([labelersPref]);
        });
        // automatically configure the client
        this.configureLabelers(prefsArrayToLabelerDids(prefs));
    }
    async setPersonalDetails({ birthDate, }) {
        birthDate = birthDate instanceof Date ? birthDate.toISOString() : birthDate;
        await this.updatePreferences((prefs) => {
            let personalDetailsPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isPersonalDetailsPref(pref) &&
                index_1.AppBskyActorDefs.validatePersonalDetailsPref(pref).success);
            if (personalDetailsPref) {
                personalDetailsPref.birthDate = birthDate;
            }
            else {
                personalDetailsPref = {
                    $type: 'app.bsky.actor.defs#personalDetailsPref',
                    birthDate,
                };
            }
            return prefs
                .filter((pref) => !index_1.AppBskyActorDefs.isPersonalDetailsPref(pref))
                .concat([personalDetailsPref]);
        });
    }
    async setFeedViewPrefs(feed, pref) {
        await this.updatePreferences((prefs) => {
            const existing = prefs.findLast((pref) => index_1.AppBskyActorDefs.isFeedViewPref(pref) &&
                index_1.AppBskyActorDefs.validateFeedViewPref(pref).success &&
                pref.feed === feed);
            if (existing) {
                pref = { ...existing, ...pref };
            }
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isFeedViewPref(pref) || p.feed !== feed)
                .concat([{ ...pref, $type: 'app.bsky.actor.defs#feedViewPref', feed }]);
        });
    }
    async setThreadViewPrefs(pref) {
        await this.updatePreferences((prefs) => {
            const existing = prefs.findLast((pref) => index_1.AppBskyActorDefs.isThreadViewPref(pref) &&
                index_1.AppBskyActorDefs.validateThreadViewPref(pref).success);
            if (existing) {
                pref = { ...existing, ...pref };
            }
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isThreadViewPref(p))
                .concat([{ ...pref, $type: 'app.bsky.actor.defs#threadViewPref' }]);
        });
    }
    async setInterestsPref(pref) {
        await this.updatePreferences((prefs) => {
            const existing = prefs.findLast((pref) => index_1.AppBskyActorDefs.isInterestsPref(pref) &&
                index_1.AppBskyActorDefs.validateInterestsPref(pref).success);
            if (existing) {
                pref = { ...existing, ...pref };
            }
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isInterestsPref(p))
                .concat([{ ...pref, $type: 'app.bsky.actor.defs#interestsPref' }]);
        });
    }
    /**
     * Add a muted word to user preferences.
     */
    async addMutedWord(mutedWord) {
        const sanitizedValue = (0, util_1.sanitizeMutedWordValue)(mutedWord.value);
        if (!sanitizedValue)
            return;
        await this.updatePreferences((prefs) => {
            let mutedWordsPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isMutedWordsPref(pref) &&
                index_1.AppBskyActorDefs.validateMutedWordsPref(pref).success);
            const newMutedWord = {
                id: common_web_1.TID.nextStr(),
                value: sanitizedValue,
                targets: mutedWord.targets || [],
                actorTarget: mutedWord.actorTarget || 'all',
                expiresAt: mutedWord.expiresAt || undefined,
            };
            if (mutedWordsPref && index_1.AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
                mutedWordsPref.items.push(newMutedWord);
                /**
                 * Migrate any old muted words that don't have an id
                 */
                mutedWordsPref.items = migrateLegacyMutedWordsItems(mutedWordsPref.items);
            }
            else {
                // if the pref doesn't exist, create it
                mutedWordsPref = {
                    items: [newMutedWord],
                };
            }
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isMutedWordsPref(p))
                .concat([
                { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
            ]);
        });
    }
    /**
     * Convenience method to add muted words to user preferences
     */
    async addMutedWords(newMutedWords) {
        await Promise.all(newMutedWords.map((word) => this.addMutedWord(word)));
    }
    /**
     * @deprecated use `addMutedWords` or `addMutedWord` instead
     */
    async upsertMutedWords(mutedWords) {
        await this.addMutedWords(mutedWords);
    }
    /**
     * Update a muted word in user preferences.
     */
    async updateMutedWord(mutedWord) {
        await this.updatePreferences((prefs) => {
            const mutedWordsPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isMutedWordsPref(pref) &&
                index_1.AppBskyActorDefs.validateMutedWordsPref(pref).success);
            if (mutedWordsPref && index_1.AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
                mutedWordsPref.items = mutedWordsPref.items.map((existingItem) => {
                    const match = matchMutedWord(existingItem, mutedWord);
                    if (match) {
                        const updated = {
                            ...existingItem,
                            ...mutedWord,
                        };
                        return {
                            id: existingItem.id || common_web_1.TID.nextStr(),
                            value: (0, util_1.sanitizeMutedWordValue)(updated.value) || existingItem.value,
                            targets: updated.targets || [],
                            actorTarget: updated.actorTarget || 'all',
                            expiresAt: updated.expiresAt || undefined,
                        };
                    }
                    else {
                        return existingItem;
                    }
                });
                /**
                 * Migrate any old muted words that don't have an id
                 */
                mutedWordsPref.items = migrateLegacyMutedWordsItems(mutedWordsPref.items);
                return prefs
                    .filter((p) => !index_1.AppBskyActorDefs.isMutedWordsPref(p))
                    .concat([
                    { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
                ]);
            }
            return prefs;
        });
    }
    /**
     * Remove a muted word from user preferences.
     */
    async removeMutedWord(mutedWord) {
        await this.updatePreferences((prefs) => {
            const mutedWordsPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isMutedWordsPref(pref) &&
                index_1.AppBskyActorDefs.validateMutedWordsPref(pref).success);
            if (mutedWordsPref && index_1.AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
                for (let i = 0; i < mutedWordsPref.items.length; i++) {
                    const match = matchMutedWord(mutedWordsPref.items[i], mutedWord);
                    if (match) {
                        mutedWordsPref.items.splice(i, 1);
                        break;
                    }
                }
                /**
                 * Migrate any old muted words that don't have an id
                 */
                mutedWordsPref.items = migrateLegacyMutedWordsItems(mutedWordsPref.items);
                return prefs
                    .filter((p) => !index_1.AppBskyActorDefs.isMutedWordsPref(p))
                    .concat([
                    { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
                ]);
            }
            return prefs;
        });
    }
    /**
     * Convenience method to remove muted words from user preferences
     */
    async removeMutedWords(mutedWords) {
        await Promise.all(mutedWords.map((word) => this.removeMutedWord(word)));
    }
    async hidePost(postUri) {
        await this.updateHiddenPost(postUri, 'hide');
    }
    async unhidePost(postUri) {
        await this.updateHiddenPost(postUri, 'unhide');
    }
    async bskyAppQueueNudges(nudges) {
        await this.updatePreferences((prefs) => {
            let bskyAppStatePref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isBskyAppStatePref(pref) &&
                index_1.AppBskyActorDefs.validateBskyAppStatePref(pref).success);
            bskyAppStatePref = bskyAppStatePref || {};
            nudges = Array.isArray(nudges) ? nudges : [nudges];
            bskyAppStatePref.queuedNudges = (bskyAppStatePref.queuedNudges || []).concat(nudges);
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isBskyAppStatePref(p))
                .concat([
                {
                    ...bskyAppStatePref,
                    $type: 'app.bsky.actor.defs#bskyAppStatePref',
                },
            ]);
        });
    }
    async bskyAppDismissNudges(nudges) {
        await this.updatePreferences((prefs) => {
            let bskyAppStatePref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isBskyAppStatePref(pref) &&
                index_1.AppBskyActorDefs.validateBskyAppStatePref(pref).success);
            bskyAppStatePref = bskyAppStatePref || {};
            nudges = Array.isArray(nudges) ? nudges : [nudges];
            bskyAppStatePref.queuedNudges = (bskyAppStatePref.queuedNudges || []).filter((nudge) => !nudges.includes(nudge));
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isBskyAppStatePref(p))
                .concat([
                {
                    ...bskyAppStatePref,
                    $type: 'app.bsky.actor.defs#bskyAppStatePref',
                },
            ]);
        });
    }
    async bskyAppSetActiveProgressGuide(guide) {
        if (guide &&
            !index_1.AppBskyActorDefs.validateBskyAppProgressGuide(guide).success) {
            throw new Error('Invalid progress guide');
        }
        await this.updatePreferences((prefs) => {
            let bskyAppStatePref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isBskyAppStatePref(pref) &&
                index_1.AppBskyActorDefs.validateBskyAppStatePref(pref).success);
            bskyAppStatePref = bskyAppStatePref || {};
            bskyAppStatePref.activeProgressGuide = guide;
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isBskyAppStatePref(p))
                .concat([
                {
                    ...bskyAppStatePref,
                    $type: 'app.bsky.actor.defs#bskyAppStatePref',
                },
            ]);
        });
    }
    /**
     * Insert or update a NUX in user prefs
     */
    async bskyAppUpsertNux(nux) {
        (0, util_1.validateNux)(nux);
        await this.updatePreferences((prefs) => {
            let bskyAppStatePref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isBskyAppStatePref(pref) &&
                index_1.AppBskyActorDefs.validateBskyAppStatePref(pref).success);
            bskyAppStatePref = bskyAppStatePref || {};
            bskyAppStatePref.nuxs = bskyAppStatePref.nuxs || [];
            const existing = bskyAppStatePref.nuxs?.find((n) => {
                return n.id === nux.id;
            });
            let next;
            if (existing) {
                next = {
                    id: existing.id,
                    completed: nux.completed,
                    data: nux.data,
                    expiresAt: nux.expiresAt,
                };
            }
            else {
                next = nux;
            }
            // remove duplicates and append
            bskyAppStatePref.nuxs = bskyAppStatePref.nuxs
                .filter((n) => n.id !== nux.id)
                .concat(next);
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isBskyAppStatePref(p))
                .concat([
                {
                    ...bskyAppStatePref,
                    $type: 'app.bsky.actor.defs#bskyAppStatePref',
                },
            ]);
        });
    }
    /**
     * Removes NUXs from user preferences.
     */
    async bskyAppRemoveNuxs(ids) {
        await this.updatePreferences((prefs) => {
            let bskyAppStatePref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isBskyAppStatePref(pref) &&
                index_1.AppBskyActorDefs.validateBskyAppStatePref(pref).success);
            bskyAppStatePref = bskyAppStatePref || {};
            bskyAppStatePref.nuxs = (bskyAppStatePref.nuxs || []).filter((nux) => {
                return !ids.includes(nux.id);
            });
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isBskyAppStatePref(p))
                .concat([
                {
                    ...bskyAppStatePref,
                    $type: 'app.bsky.actor.defs#bskyAppStatePref',
                },
            ]);
        });
    }
    /**
     * This function updates the preferences of a user and allows for a callback function to be executed
     * before the update.
     * @param cb - cb is a callback function that takes in a single parameter of type
     * AppBskyActorDefs.Preferences and returns either a boolean or void. This callback function is used to
     * update the preferences of the user. The function is called with the current preferences as an
     * argument and if the callback returns false, the preferences are not updated.
     */
    async updatePreferences(cb) {
        try {
            await __classPrivateFieldGet(this, _Agent_prefsLock, "f").acquireAsync();
            const res = await this.app.bsky.actor.getPreferences({});
            const newPrefs = cb(res.data.preferences);
            if (newPrefs === false) {
                return res.data.preferences;
            }
            await this.app.bsky.actor.putPreferences({
                preferences: newPrefs,
            });
            return newPrefs;
        }
        finally {
            __classPrivateFieldGet(this, _Agent_prefsLock, "f").release();
        }
    }
    async updateHiddenPost(postUri, action) {
        await this.updatePreferences((prefs) => {
            let pref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isHiddenPostsPref(pref) &&
                index_1.AppBskyActorDefs.validateHiddenPostsPref(pref).success);
            if (pref && index_1.AppBskyActorDefs.isHiddenPostsPref(pref)) {
                pref.items =
                    action === 'hide'
                        ? Array.from(new Set([...pref.items, postUri]))
                        : pref.items.filter((uri) => uri !== postUri);
            }
            else {
                if (action === 'hide') {
                    pref = {
                        $type: 'app.bsky.actor.defs#hiddenPostsPref',
                        items: [postUri],
                    };
                }
            }
            return prefs
                .filter((p) => !index_1.AppBskyActorDefs.isInterestsPref(p))
                .concat([{ ...pref, $type: 'app.bsky.actor.defs#hiddenPostsPref' }]);
        });
    }
    /**
     * A helper specifically for updating feed preferences
     */
    async updateFeedPreferences(cb) {
        let res;
        await this.updatePreferences((prefs) => {
            let feedsPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isSavedFeedsPref(pref) &&
                index_1.AppBskyActorDefs.validateSavedFeedsPref(pref).success);
            if (feedsPref) {
                res = cb(feedsPref.saved, feedsPref.pinned);
                feedsPref.saved = res.saved;
                feedsPref.pinned = res.pinned;
            }
            else {
                res = cb([], []);
                feedsPref = {
                    $type: 'app.bsky.actor.defs#savedFeedsPref',
                    saved: res.saved,
                    pinned: res.pinned,
                };
            }
            return prefs
                .filter((pref) => !index_1.AppBskyActorDefs.isSavedFeedsPref(pref))
                .concat([feedsPref]);
        });
        return res;
    }
    async updateSavedFeedsV2Preferences(cb) {
        let maybeMutatedSavedFeeds = [];
        await this.updatePreferences((prefs) => {
            let existingV2Pref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isSavedFeedsPrefV2(pref) &&
                index_1.AppBskyActorDefs.validateSavedFeedsPrefV2(pref).success);
            let existingV1Pref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isSavedFeedsPref(pref) &&
                index_1.AppBskyActorDefs.validateSavedFeedsPref(pref).success);
            if (existingV2Pref) {
                maybeMutatedSavedFeeds = cb(existingV2Pref.items);
                existingV2Pref = {
                    ...existingV2Pref,
                    items: maybeMutatedSavedFeeds,
                };
            }
            else {
                maybeMutatedSavedFeeds = cb([]);
                existingV2Pref = {
                    $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
                    items: maybeMutatedSavedFeeds,
                };
            }
            // enforce ordering, pinned then saved
            const pinned = existingV2Pref.items.filter((i) => i.pinned);
            const saved = existingV2Pref.items.filter((i) => !i.pinned);
            existingV2Pref.items = pinned.concat(saved);
            let updatedPrefs = prefs
                .filter((pref) => !index_1.AppBskyActorDefs.isSavedFeedsPrefV2(pref))
                .concat(existingV2Pref);
            /*
             * If there's a v2 pref present, it means this account was migrated from v1
             * to v2. During the transition period, we double write v2 prefs back to
             * v1, but NOT the other way around.
             */
            if (existingV1Pref) {
                const { saved, pinned } = existingV1Pref;
                const v2Compat = (0, util_1.savedFeedsToUriArrays)(
                // v1 only supports feeds and lists
                existingV2Pref.items.filter((i) => ['feed', 'list'].includes(i.type)));
                existingV1Pref = {
                    ...existingV1Pref,
                    saved: Array.from(new Set([...saved, ...v2Compat.saved])),
                    pinned: Array.from(new Set([...pinned, ...v2Compat.pinned])),
                };
                updatedPrefs = updatedPrefs
                    .filter((pref) => !index_1.AppBskyActorDefs.isSavedFeedsPref(pref))
                    .concat(existingV1Pref);
            }
            return updatedPrefs;
        });
        return maybeMutatedSavedFeeds;
    }
}
exports.Agent = Agent;
_Agent_prefsLock = new WeakMap();
//#region Static configuration
/**
 * The labelers to be used across all requests with the takedown capability
 */
Object.defineProperty(Agent, "appLabelers", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: [const_1.BSKY_LABELER_DID]
});
/**
 * Helper to transform the legacy content preferences.
 */
function adjustLegacyContentLabelPref(pref) {
    let visibility = pref.visibility;
    // adjust legacy values
    if (visibility === 'show') {
        visibility = 'ignore';
    }
    return { ...pref, visibility };
}
/**
 * Re-maps legacy labels to new labels on READ. Does not save these changes to
 * the user's preferences.
 */
function remapLegacyLabels(labels) {
    const _labels = { ...labels };
    const legacyToNewMap = {
        gore: 'graphic-media',
        nsfw: 'porn',
        suggestive: 'sexual',
    };
    for (const labelName in _labels) {
        const newLabelName = legacyToNewMap[labelName];
        if (newLabelName) {
            _labels[newLabelName] = _labels[labelName];
        }
    }
    return _labels;
}
/**
 * A helper to get the currently enabled labelers from the full preferences array
 */
function prefsArrayToLabelerDids(prefs) {
    const labelersPref = prefs.findLast((pref) => index_1.AppBskyActorDefs.isLabelersPref(pref) &&
        index_1.AppBskyActorDefs.validateLabelersPref(pref).success);
    let dids = [];
    if (labelersPref) {
        dids = labelersPref.labelers.map((labeler) => labeler.did);
    }
    return dids;
}
function isBskyPrefs(v) {
    return (v &&
        typeof v === 'object' &&
        'moderationPrefs' in v &&
        isModPrefs(v.moderationPrefs));
}
function isModPrefs(v) {
    return v && typeof v === 'object' && 'labelers' in v;
}
function migrateLegacyMutedWordsItems(items) {
    return items.map((item) => ({
        ...item,
        id: item.id || common_web_1.TID.nextStr(),
    }));
}
function matchMutedWord(existingWord, newWord) {
    // id is undefined in legacy implementation
    const existingId = existingWord.id;
    // prefer matching based on id
    const matchById = existingId && existingId === newWord.id;
    // handle legacy case where id is not set
    const legacyMatchByValue = !existingId && existingWord.value === newWord.value;
    return matchById || legacyMatchByValue;
}
//# sourceMappingURL=agent.js.map