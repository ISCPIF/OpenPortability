"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAG_REGEX = exports.TRAILING_PUNCTUATION_REGEX = exports.URL_REGEX = exports.MENTION_REGEX = void 0;
exports.MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g;
exports.URL_REGEX = /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim;
exports.TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu;
/**
 * `\ufe0f` emoji modifier
 * `\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2` zero-width spaces (likely incomplete)
 */
exports.TAG_REGEX = 
// eslint-disable-next-line no-misleading-character-class
/(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu;
//# sourceMappingURL=util.js.map