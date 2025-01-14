/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs';
import * as AppBskyActorDefs from '../actor/defs';
import * as AppBskyRichtextFacet from '../richtext/facet';
import * as AppBskyFeedDefs from '../feed/defs';
export interface ListViewBasic {
    uri: string;
    cid: string;
    name: string;
    purpose: ListPurpose;
    avatar?: string;
    listItemCount?: number;
    labels?: ComAtprotoLabelDefs.Label[];
    viewer?: ListViewerState;
    indexedAt?: string;
    [k: string]: unknown;
}
export declare function isListViewBasic(v: unknown): v is ListViewBasic;
export declare function validateListViewBasic(v: unknown): ValidationResult;
export interface ListView {
    uri: string;
    cid: string;
    creator: AppBskyActorDefs.ProfileView;
    name: string;
    purpose: ListPurpose;
    description?: string;
    descriptionFacets?: AppBskyRichtextFacet.Main[];
    avatar?: string;
    listItemCount?: number;
    labels?: ComAtprotoLabelDefs.Label[];
    viewer?: ListViewerState;
    indexedAt: string;
    [k: string]: unknown;
}
export declare function isListView(v: unknown): v is ListView;
export declare function validateListView(v: unknown): ValidationResult;
export interface ListItemView {
    uri: string;
    subject: AppBskyActorDefs.ProfileView;
    [k: string]: unknown;
}
export declare function isListItemView(v: unknown): v is ListItemView;
export declare function validateListItemView(v: unknown): ValidationResult;
export interface StarterPackView {
    uri: string;
    cid: string;
    record: {};
    creator: AppBskyActorDefs.ProfileViewBasic;
    list?: ListViewBasic;
    listItemsSample?: ListItemView[];
    feeds?: AppBskyFeedDefs.GeneratorView[];
    joinedWeekCount?: number;
    joinedAllTimeCount?: number;
    labels?: ComAtprotoLabelDefs.Label[];
    indexedAt: string;
    [k: string]: unknown;
}
export declare function isStarterPackView(v: unknown): v is StarterPackView;
export declare function validateStarterPackView(v: unknown): ValidationResult;
export interface StarterPackViewBasic {
    uri: string;
    cid: string;
    record: {};
    creator: AppBskyActorDefs.ProfileViewBasic;
    listItemCount?: number;
    joinedWeekCount?: number;
    joinedAllTimeCount?: number;
    labels?: ComAtprotoLabelDefs.Label[];
    indexedAt: string;
    [k: string]: unknown;
}
export declare function isStarterPackViewBasic(v: unknown): v is StarterPackViewBasic;
export declare function validateStarterPackViewBasic(v: unknown): ValidationResult;
export type ListPurpose = 'app.bsky.graph.defs#modlist' | 'app.bsky.graph.defs#curatelist' | 'app.bsky.graph.defs#referencelist' | (string & {});
/** A list of actors to apply an aggregate moderation action (mute/block) on. */
export declare const MODLIST = "app.bsky.graph.defs#modlist";
/** A list of actors used for curation purposes such as list feeds or interaction gating. */
export declare const CURATELIST = "app.bsky.graph.defs#curatelist";
/** A list of actors used for only for reference purposes such as within a starter pack. */
export declare const REFERENCELIST = "app.bsky.graph.defs#referencelist";
export interface ListViewerState {
    muted?: boolean;
    blocked?: string;
    [k: string]: unknown;
}
export declare function isListViewerState(v: unknown): v is ListViewerState;
export declare function validateListViewerState(v: unknown): ValidationResult;
/** indicates that a handle or DID could not be resolved */
export interface NotFoundActor {
    actor: string;
    notFound: true;
    [k: string]: unknown;
}
export declare function isNotFoundActor(v: unknown): v is NotFoundActor;
export declare function validateNotFoundActor(v: unknown): ValidationResult;
/** lists the bi-directional graph relationships between one actor (not indicated in the object), and the target actors (the DID included in the object) */
export interface Relationship {
    did: string;
    /** if the actor follows this DID, this is the AT-URI of the follow record */
    following?: string;
    /** if the actor is followed by this DID, contains the AT-URI of the follow record */
    followedBy?: string;
    [k: string]: unknown;
}
export declare function isRelationship(v: unknown): v is Relationship;
export declare function validateRelationship(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map