"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOption = isOption;
exports.validateOption = validateOption;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isOption(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.setting.defs#option');
}
function validateOption(v) {
    return lexicons_1.lexicons.validate('tools.ozone.setting.defs#option', v);
}
//# sourceMappingURL=defs.js.map