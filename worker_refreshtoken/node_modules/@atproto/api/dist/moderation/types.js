"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOOP_BEHAVIOR = exports.HIDE_BEHAVIOR = exports.MUTEWORD_BEHAVIOR = exports.MUTE_BEHAVIOR = exports.BLOCK_BEHAVIOR = exports.CUSTOM_LABEL_VALUE_RE = void 0;
// syntax
// =
exports.CUSTOM_LABEL_VALUE_RE = /^[a-z-]+$/;
exports.BLOCK_BEHAVIOR = {
    profileList: 'blur',
    profileView: 'alert',
    avatar: 'blur',
    banner: 'blur',
    contentList: 'blur',
    contentView: 'blur',
};
exports.MUTE_BEHAVIOR = {
    profileList: 'inform',
    profileView: 'alert',
    contentList: 'blur',
    contentView: 'inform',
};
exports.MUTEWORD_BEHAVIOR = {
    contentList: 'blur',
    contentView: 'blur',
};
exports.HIDE_BEHAVIOR = {
    contentList: 'blur',
    contentView: 'blur',
};
exports.NOOP_BEHAVIOR = {};
//# sourceMappingURL=types.js.map