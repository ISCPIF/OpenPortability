"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSigDetail = isSigDetail;
exports.validateSigDetail = validateSigDetail;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isSigDetail(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.signature.defs#sigDetail');
}
function validateSigDetail(v) {
    return lexicons_1.lexicons.validate('tools.ozone.signature.defs#sigDetail', v);
}
//# sourceMappingURL=defs.js.map