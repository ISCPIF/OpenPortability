"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectFacets = detectFacets;
const tlds_1 = __importDefault(require("tlds"));
const util_1 = require("./util");
function detectFacets(text) {
    let match;
    const facets = [];
    {
        // mentions
        const re = util_1.MENTION_REGEX;
        while ((match = re.exec(text.utf16))) {
            if (!isValidDomain(match[3]) && !match[3].endsWith('.test')) {
                continue; // probably not a handle
            }
            const start = text.utf16.indexOf(match[3], match.index) - 1;
            facets.push({
                $type: 'app.bsky.richtext.facet',
                index: {
                    byteStart: text.utf16IndexToUtf8Index(start),
                    byteEnd: text.utf16IndexToUtf8Index(start + match[3].length + 1),
                },
                features: [
                    {
                        $type: 'app.bsky.richtext.facet#mention',
                        did: match[3], // must be resolved afterwards
                    },
                ],
            });
        }
    }
    {
        // links
        const re = util_1.URL_REGEX;
        while ((match = re.exec(text.utf16))) {
            let uri = match[2];
            if (!uri.startsWith('http')) {
                const domain = match.groups?.domain;
                if (!domain || !isValidDomain(domain)) {
                    continue;
                }
                uri = `https://${uri}`;
            }
            const start = text.utf16.indexOf(match[2], match.index);
            const index = { start, end: start + match[2].length };
            // strip ending puncuation
            if (/[.,;:!?]$/.test(uri)) {
                uri = uri.slice(0, -1);
                index.end--;
            }
            if (/[)]$/.test(uri) && !uri.includes('(')) {
                uri = uri.slice(0, -1);
                index.end--;
            }
            facets.push({
                index: {
                    byteStart: text.utf16IndexToUtf8Index(index.start),
                    byteEnd: text.utf16IndexToUtf8Index(index.end),
                },
                features: [
                    {
                        $type: 'app.bsky.richtext.facet#link',
                        uri,
                    },
                ],
            });
        }
    }
    {
        const re = util_1.TAG_REGEX;
        while ((match = re.exec(text.utf16))) {
            const leading = match[1];
            let tag = match[2];
            if (!tag)
                continue;
            // strip ending punctuation and any spaces
            tag = tag.trim().replace(util_1.TRAILING_PUNCTUATION_REGEX, '');
            if (tag.length === 0 || tag.length > 64)
                continue;
            const index = match.index + leading.length;
            facets.push({
                index: {
                    byteStart: text.utf16IndexToUtf8Index(index),
                    byteEnd: text.utf16IndexToUtf8Index(index + 1 + tag.length),
                },
                features: [
                    {
                        $type: 'app.bsky.richtext.facet#tag',
                        tag: tag,
                    },
                ],
            });
        }
    }
    return facets.length > 0 ? facets : undefined;
}
function isValidDomain(str) {
    return !!tlds_1.default.find((tld) => {
        const i = str.lastIndexOf(tld);
        if (i === -1) {
            return false;
        }
        return str.charAt(i - 1) === '.' && i === str.length - tld.length;
    });
}
//# sourceMappingURL=detection.js.map