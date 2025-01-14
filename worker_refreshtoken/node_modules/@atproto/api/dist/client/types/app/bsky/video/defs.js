"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJobStatus = isJobStatus;
exports.validateJobStatus = validateJobStatus;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isJobStatus(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'app.bsky.video.defs#jobStatus');
}
function validateJobStatus(v) {
    return lexicons_1.lexicons.validate('app.bsky.video.defs#jobStatus', v);
}
//# sourceMappingURL=defs.js.map