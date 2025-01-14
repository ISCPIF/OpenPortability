"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeRichText = sanitizeRichText;
const unicode_1 = require("./unicode");
// this regex is intentionally matching on the zero-with-separator codepoint
// eslint-disable-next-line no-misleading-character-class
const EXCESS_SPACE_RE = /[\r\n]([\u00AD\u2060\u200D\u200C\u200B\s]*[\r\n]){2,}/;
const REPLACEMENT_STR = '\n\n';
function sanitizeRichText(richText, opts) {
    if (opts.cleanNewlines) {
        richText = clean(richText, EXCESS_SPACE_RE, REPLACEMENT_STR);
    }
    return richText;
}
function clean(richText, targetRegexp, replacementString) {
    richText = richText.clone();
    let match = richText.unicodeText.utf16.match(targetRegexp);
    while (match && typeof match.index !== 'undefined') {
        const oldText = richText.unicodeText;
        const removeStartIndex = richText.unicodeText.utf16IndexToUtf8Index(match.index);
        const removeEndIndex = removeStartIndex + new unicode_1.UnicodeString(match[0]).length;
        richText.delete(removeStartIndex, removeEndIndex);
        if (richText.unicodeText.utf16 === oldText.utf16) {
            break; // sanity check
        }
        richText.insert(removeStartIndex, replacementString);
        match = richText.unicodeText.utf16.match(targetRegexp);
    }
    return richText;
}
//# sourceMappingURL=sanitization.js.map