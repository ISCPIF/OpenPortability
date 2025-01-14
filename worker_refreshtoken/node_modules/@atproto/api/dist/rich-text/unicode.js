"use strict";
/**
 * Javascript uses utf16-encoded strings while most environments and specs
 * have standardized around utf8 (including JSON).
 *
 * After some lengthy debated we decided that richtext facets need to use
 * utf8 indices. This means we need tools to convert indices between utf8
 * and utf16, and that's precisely what this library handles.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnicodeString = void 0;
const common_web_1 = require("@atproto/common-web");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
class UnicodeString {
    constructor(utf16) {
        Object.defineProperty(this, "utf16", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "utf8", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_graphemeLen", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.utf16 = utf16;
        this.utf8 = encoder.encode(utf16);
    }
    get length() {
        return this.utf8.byteLength;
    }
    get graphemeLength() {
        if (!this._graphemeLen) {
            this._graphemeLen = (0, common_web_1.graphemeLen)(this.utf16);
        }
        return this._graphemeLen;
    }
    slice(start, end) {
        return decoder.decode(this.utf8.slice(start, end));
    }
    utf16IndexToUtf8Index(i) {
        return encoder.encode(this.utf16.slice(0, i)).byteLength;
    }
    toString() {
        return this.utf16;
    }
}
exports.UnicodeString = UnicodeString;
//# sourceMappingURL=unicode.js.map