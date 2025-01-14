"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isSuggestion = isSuggestion;
exports.validateSuggestion = validateSuggestion;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isSuggestion(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.unspecced.getTaggedSuggestions#suggestion');
}
function validateSuggestion(v) {
    return lexicons_1.lexicons.validate('app.bsky.unspecced.getTaggedSuggestions#suggestion', v);
}
//# sourceMappingURL=getTaggedSuggestions.js.map