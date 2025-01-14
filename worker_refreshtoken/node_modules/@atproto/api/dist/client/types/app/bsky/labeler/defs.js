"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLabelerView = isLabelerView;
exports.validateLabelerView = validateLabelerView;
exports.isLabelerViewDetailed = isLabelerViewDetailed;
exports.validateLabelerViewDetailed = validateLabelerViewDetailed;
exports.isLabelerViewerState = isLabelerViewerState;
exports.validateLabelerViewerState = validateLabelerViewerState;
exports.isLabelerPolicies = isLabelerPolicies;
exports.validateLabelerPolicies = validateLabelerPolicies;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isLabelerView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.labeler.defs#labelerView');
}
function validateLabelerView(v) {
    return lexicons_1.lexicons.validate('app.bsky.labeler.defs#labelerView', v);
}
function isLabelerViewDetailed(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.labeler.defs#labelerViewDetailed');
}
function validateLabelerViewDetailed(v) {
    return lexicons_1.lexicons.validate('app.bsky.labeler.defs#labelerViewDetailed', v);
}
function isLabelerViewerState(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.labeler.defs#labelerViewerState');
}
function validateLabelerViewerState(v) {
    return lexicons_1.lexicons.validate('app.bsky.labeler.defs#labelerViewerState', v);
}
function isLabelerPolicies(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.labeler.defs#labelerPolicies');
}
function validateLabelerPolicies(v) {
    return lexicons_1.lexicons.validate('app.bsky.labeler.defs#labelerPolicies', v);
}
//# sourceMappingURL=defs.js.map