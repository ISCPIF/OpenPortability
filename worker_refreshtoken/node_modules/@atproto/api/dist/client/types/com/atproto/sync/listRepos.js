"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isRepo = isRepo;
exports.validateRepo = validateRepo;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isRepo(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'com.atproto.sync.listRepos#repo');
}
function validateRepo(v) {
    return lexicons_1.lexicons.validate('com.atproto.sync.listRepos#repo', v);
}
//# sourceMappingURL=listRepos.js.map