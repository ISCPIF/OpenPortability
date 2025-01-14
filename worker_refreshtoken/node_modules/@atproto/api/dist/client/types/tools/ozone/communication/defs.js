"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTemplateView = isTemplateView;
exports.validateTemplateView = validateTemplateView;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isTemplateView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.communication.defs#templateView');
}
function validateTemplateView(v) {
    return lexicons_1.lexicons.validate('tools.ozone.communication.defs#templateView', v);
}
//# sourceMappingURL=defs.js.map