import { AppBskyFeedPost, AppBskyRichtextFacet, AtpBaseClient } from '../client';
import { UnicodeString } from './unicode';
export type Facet = AppBskyRichtextFacet.Main;
export type FacetLink = AppBskyRichtextFacet.Link;
export type FacetMention = AppBskyRichtextFacet.Mention;
export type FacetTag = AppBskyRichtextFacet.Tag;
export type Entity = AppBskyFeedPost.Entity;
export interface RichTextProps {
    text: string;
    facets?: Facet[];
    /**
     * @deprecated Use facets instead
     */
    entities?: Entity[];
}
export interface RichTextOpts {
    cleanNewlines?: boolean;
}
export declare class RichTextSegment {
    text: string;
    facet?: Facet | undefined;
    constructor(text: string, facet?: Facet | undefined);
    get link(): FacetLink | undefined;
    isLink(): boolean;
    get mention(): FacetMention | undefined;
    isMention(): boolean;
    get tag(): FacetTag | undefined;
    isTag(): boolean;
}
export declare class RichText {
    unicodeText: UnicodeString;
    facets?: Facet[];
    constructor(props: RichTextProps, opts?: RichTextOpts);
    get text(): string;
    get length(): number;
    get graphemeLength(): number;
    clone(): RichText;
    copyInto(target: RichText): void;
    segments(): Generator<RichTextSegment, void, void>;
    insert(insertIndex: number, insertText: string): this;
    delete(removeStartIndex: number, removeEndIndex: number): this;
    /**
     * Detects facets such as links and mentions
     * Note: Overwrites the existing facets with auto-detected facets
     */
    detectFacets(agent: AtpBaseClient): Promise<void>;
    /**
     * Detects facets such as links and mentions but does not resolve them
     * Will produce invalid facets! For instance, mentions will not have their DIDs set.
     * Note: Overwrites the existing facets with auto-detected facets
     */
    detectFacetsWithoutResolution(): void;
}
//# sourceMappingURL=rich-text.d.ts.map