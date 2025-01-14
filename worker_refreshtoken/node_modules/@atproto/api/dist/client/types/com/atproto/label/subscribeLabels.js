"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLabels = isLabels;
exports.validateLabels = validateLabels;
exports.isInfo = isInfo;
exports.validateInfo = validateInfo;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isLabels(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.label.subscribeLabels#labels');
}
function validateLabels(v) {
    return lexicons_1.lexicons.validate('com.atproto.label.subscribeLabels#labels', v);
}
function isInfo(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.label.subscribeLabels#info');
}
function validateInfo(v) {
    return lexicons_1.lexicons.validate('com.atproto.label.subscribeLabels#info', v);
}
//# sourceMappingURL=subscribeLabels.js.map