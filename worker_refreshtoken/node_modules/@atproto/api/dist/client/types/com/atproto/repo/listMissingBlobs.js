"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isRecordBlob = isRecordBlob;
exports.validateRecordBlob = validateRecordBlob;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isRecordBlob(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.repo.listMissingBlobs#recordBlob');
}
function validateRecordBlob(v) {
    return lexicons_1.lexicons.validate('com.atproto.repo.listMissingBlobs#recordBlob', v);
}
//# sourceMappingURL=listMissingBlobs.js.map