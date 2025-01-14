/**
 * Javascript uses utf16-encoded strings while most environments and specs
 * have standardized around utf8 (including JSON).
 *
 * After some lengthy debated we decided that richtext facets need to use
 * utf8 indices. This means we need tools to convert indices between utf8
 * and utf16, and that's precisely what this library handles.
 */
export declare class UnicodeString {
    utf16: string;
    utf8: Uint8Array;
    private _graphemeLen?;
    constructor(utf16: string);
    get length(): number;
    get graphemeLength(): number;
    slice(start?: number, end?: number): string;
    utf16IndexToUtf8Index(i: number): number;
    toString(): string;
}
//# sourceMappingURL=unicode.d.ts.map