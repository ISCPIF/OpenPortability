"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSet = isSet;
exports.validateSet = validateSet;
exports.isSetView = isSetView;
exports.validateSetView = validateSetView;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isSet(v) {
    return ((0, util_1.isObj)(v) && (0, util_1.hasProp)(v, '$type') && v.$type === 'tools.ozone.set.defs#set');
}
function validateSet(v) {
    return lexicons_1.lexicons.validate('tools.ozone.set.defs#set', v);
}
function isSetView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.set.defs#setView');
}
function validateSetView(v) {
    return lexicons_1.lexicons.validate('tools.ozone.set.defs#setView', v);
}
//# sourceMappingURL=defs.js.map