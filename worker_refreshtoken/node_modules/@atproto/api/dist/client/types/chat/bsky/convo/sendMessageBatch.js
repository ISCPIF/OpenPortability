"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toKnownErr = toKnownErr;
exports.isBatchItem = isBatchItem;
exports.validateBatchItem = validateBatchItem;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function toKnownErr(e) {
    return e;
}
function isBatchItem(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.sendMessageBatch#batchItem');
}
function validateBatchItem(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.sendMessageBatch#batchItem', v);
}
//# sourceMappingURL=sendMessageBatch.js.map