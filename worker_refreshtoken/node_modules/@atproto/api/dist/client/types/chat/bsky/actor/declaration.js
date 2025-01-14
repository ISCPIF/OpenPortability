"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.validateRecord = validateRecord;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isRecord(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        (v.$type === 'chat.bsky.actor.declaration#main' ||
            v.$type === 'chat.bsky.actor.declaration'));
}
function validateRecord(v) {
    return lexicons_1.lexicons.validate('chat.bsky.actor.declaration#main', v);
}
//# sourceMappingURL=declaration.js.map