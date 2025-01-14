"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lexicons = exports.default = exports.BskyAgent = exports.CredentialSession = exports.AtpAgent = exports.Agent = exports.DEFAULT_LABEL_SETTINGS = exports.LABELS = exports.schemas = exports.parseLanguage = exports.jsonStringToLex = exports.jsonToLex = exports.stringifyLex = exports.lexToJson = exports.BlobRef = exports.AtUri = void 0;
const lexicon_1 = require("@atproto/lexicon");
const lexicons_1 = require("./client/lexicons");
var syntax_1 = require("@atproto/syntax");
Object.defineProperty(exports, "AtUri", { enumerable: true, get: function () { return syntax_1.AtUri; } });
var lexicon_2 = require("@atproto/lexicon");
Object.defineProperty(exports, "BlobRef", { enumerable: true, get: function () { return lexicon_2.BlobRef; } });
Object.defineProperty(exports, "lexToJson", { enumerable: true, get: function () { return lexicon_2.lexToJson; } });
Object.defineProperty(exports, "stringifyLex", { enumerable: true, get: function () { return lexicon_2.stringifyLex; } });
Object.defineProperty(exports, "jsonToLex", { enumerable: true, get: function () { return lexicon_2.jsonToLex; } });
Object.defineProperty(exports, "jsonStringToLex", { enumerable: true, get: function () { return lexicon_2.jsonStringToLex; } });
var common_web_1 = require("@atproto/common-web");
Object.defineProperty(exports, "parseLanguage", { enumerable: true, get: function () { return common_web_1.parseLanguage; } });
__exportStar(require("./types"), exports);
__exportStar(require("./const"), exports);
__exportStar(require("./util"), exports);
__exportStar(require("./client"), exports);
var lexicons_2 = require("./client/lexicons");
Object.defineProperty(exports, "schemas", { enumerable: true, get: function () { return lexicons_2.schemas; } });
__exportStar(require("./rich-text/rich-text"), exports);
__exportStar(require("./rich-text/sanitization"), exports);
__exportStar(require("./rich-text/unicode"), exports);
__exportStar(require("./rich-text/util"), exports);
__exportStar(require("./moderation"), exports);
__exportStar(require("./moderation/types"), exports);
__exportStar(require("./mocker"), exports);
var labels_1 = require("./moderation/const/labels");
Object.defineProperty(exports, "LABELS", { enumerable: true, get: function () { return labels_1.LABELS; } });
Object.defineProperty(exports, "DEFAULT_LABEL_SETTINGS", { enumerable: true, get: function () { return labels_1.DEFAULT_LABEL_SETTINGS; } });
var agent_1 = require("./agent");
Object.defineProperty(exports, "Agent", { enumerable: true, get: function () { return agent_1.Agent; } });
var atp_agent_1 = require("./atp-agent");
Object.defineProperty(exports, "AtpAgent", { enumerable: true, get: function () { return atp_agent_1.AtpAgent; } });
var atp_agent_2 = require("./atp-agent");
Object.defineProperty(exports, "CredentialSession", { enumerable: true, get: function () { return atp_agent_2.CredentialSession; } });
var bsky_agent_1 = require("./bsky-agent");
Object.defineProperty(exports, "BskyAgent", { enumerable: true, get: function () { return bsky_agent_1.BskyAgent; } });
var atp_agent_3 = require("./atp-agent");
/** @deprecated */
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return atp_agent_3.AtpAgent; } });
// Expose a copy to prevent alteration of the internal Lexicon instance used by
// the AtpBaseClient class.
exports.lexicons = new lexicon_1.Lexicons(lexicons_1.lexicons);
//# sourceMappingURL=index.js.map