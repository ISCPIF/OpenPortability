"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMessageRef = isMessageRef;
exports.validateMessageRef = validateMessageRef;
exports.isMessageInput = isMessageInput;
exports.validateMessageInput = validateMessageInput;
exports.isMessageView = isMessageView;
exports.validateMessageView = validateMessageView;
exports.isDeletedMessageView = isDeletedMessageView;
exports.validateDeletedMessageView = validateDeletedMessageView;
exports.isMessageViewSender = isMessageViewSender;
exports.validateMessageViewSender = validateMessageViewSender;
exports.isConvoView = isConvoView;
exports.validateConvoView = validateConvoView;
exports.isLogBeginConvo = isLogBeginConvo;
exports.validateLogBeginConvo = validateLogBeginConvo;
exports.isLogLeaveConvo = isLogLeaveConvo;
exports.validateLogLeaveConvo = validateLogLeaveConvo;
exports.isLogCreateMessage = isLogCreateMessage;
exports.validateLogCreateMessage = validateLogCreateMessage;
exports.isLogDeleteMessage = isLogDeleteMessage;
exports.validateLogDeleteMessage = validateLogDeleteMessage;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isMessageRef(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#messageRef');
}
function validateMessageRef(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#messageRef', v);
}
function isMessageInput(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#messageInput');
}
function validateMessageInput(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#messageInput', v);
}
function isMessageView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#messageView');
}
function validateMessageView(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#messageView', v);
}
function isDeletedMessageView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#deletedMessageView');
}
function validateDeletedMessageView(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#deletedMessageView', v);
}
function isMessageViewSender(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#messageViewSender');
}
function validateMessageViewSender(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#messageViewSender', v);
}
function isConvoView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#convoView');
}
function validateConvoView(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#convoView', v);
}
function isLogBeginConvo(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#logBeginConvo');
}
function validateLogBeginConvo(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#logBeginConvo', v);
}
function isLogLeaveConvo(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#logLeaveConvo');
}
function validateLogLeaveConvo(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#logLeaveConvo', v);
}
function isLogCreateMessage(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#logCreateMessage');
}
function validateLogCreateMessage(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#logCreateMessage', v);
}
function isLogDeleteMessage(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'chat.bsky.convo.defs#logDeleteMessage');
}
function validateLogDeleteMessage(v) {
    return lexicons_1.lexicons.validate('chat.bsky.convo.defs#logDeleteMessage', v);
}
//# sourceMappingURL=defs.js.map