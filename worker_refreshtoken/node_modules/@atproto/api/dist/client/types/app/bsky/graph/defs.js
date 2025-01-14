"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFERENCELIST = exports.CURATELIST = exports.MODLIST = void 0;
exports.isListViewBasic = isListViewBasic;
exports.validateListViewBasic = validateListViewBasic;
exports.isListView = isListView;
exports.validateListView = validateListView;
exports.isListItemView = isListItemView;
exports.validateListItemView = validateListItemView;
exports.isStarterPackView = isStarterPackView;
exports.validateStarterPackView = validateStarterPackView;
exports.isStarterPackViewBasic = isStarterPackViewBasic;
exports.validateStarterPackViewBasic = validateStarterPackViewBasic;
exports.isListViewerState = isListViewerState;
exports.validateListViewerState = validateListViewerState;
exports.isNotFoundActor = isNotFoundActor;
exports.validateNotFoundActor = validateNotFoundActor;
exports.isRelationship = isRelationship;
exports.validateRelationship = validateRelationship;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isListViewBasic(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#listViewBasic');
}
function validateListViewBasic(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#listViewBasic', v);
}
function isListView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#listView');
}
function validateListView(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#listView', v);
}
function isListItemView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#listItemView');
}
function validateListItemView(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#listItemView', v);
}
function isStarterPackView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#starterPackView');
}
function validateStarterPackView(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#starterPackView', v);
}
function isStarterPackViewBasic(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#starterPackViewBasic');
}
function validateStarterPackViewBasic(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#starterPackViewBasic', v);
}
/** A list of actors to apply an aggregate moderation action (mute/block) on. */
exports.MODLIST = 'app.bsky.graph.defs#modlist';
/** A list of actors used for curation purposes such as list feeds or interaction gating. */
exports.CURATELIST = 'app.bsky.graph.defs#curatelist';
/** A list of actors used for only for reference purposes such as within a starter pack. */
exports.REFERENCELIST = 'app.bsky.graph.defs#referencelist';
function isListViewerState(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#listViewerState');
}
function validateListViewerState(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#listViewerState', v);
}
function isNotFoundActor(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#notFoundActor');
}
function validateNotFoundActor(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#notFoundActor', v);
}
function isRelationship(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.graph.defs#relationship');
}
function validateRelationship(v) {
    return lexicons_1.lexicons.validate('app.bsky.graph.defs#relationship', v);
}
//# sourceMappingURL=defs.js.map