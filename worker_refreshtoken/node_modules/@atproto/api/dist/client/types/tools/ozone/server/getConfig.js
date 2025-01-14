"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isServiceConfig = isServiceConfig;
exports.validateServiceConfig = validateServiceConfig;
exports.isViewerConfig = isViewerConfig;
exports.validateViewerConfig = validateViewerConfig;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isServiceConfig(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.server.getConfig#serviceConfig');
}
function validateServiceConfig(v) {
    return lexicons_1.lexicons.validate('tools.ozone.server.getConfig#serviceConfig', v);
}
function isViewerConfig(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.server.getConfig#viewerConfig');
}
function validateViewerConfig(v) {
    return lexicons_1.lexicons.validate('tools.ozone.server.getConfig#viewerConfig', v);
}
//# sourceMappingURL=getConfig.js.map