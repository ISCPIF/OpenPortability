"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LABELS = exports.DEFAULT_LABEL_SETTINGS = void 0;
exports.DEFAULT_LABEL_SETTINGS = {
    porn: 'hide',
    sexual: 'warn',
    nudity: 'ignore',
    'graphic-media': 'warn',
};
exports.LABELS = {
    '!hide': {
        identifier: '!hide',
        configurable: false,
        defaultSetting: 'hide',
        flags: ['no-override', 'no-self'],
        severity: 'alert',
        blurs: 'content',
        behaviors: {
            account: {
                profileList: 'blur',
                profileView: 'blur',
                avatar: 'blur',
                banner: 'blur',
                displayName: 'blur',
                contentList: 'blur',
                contentView: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
                displayName: 'blur',
            },
            content: {
                contentList: 'blur',
                contentView: 'blur',
            },
        },
        locales: [],
    },
    '!warn': {
        identifier: '!warn',
        configurable: false,
        defaultSetting: 'warn',
        flags: ['no-self'],
        severity: 'none',
        blurs: 'content',
        behaviors: {
            account: {
                profileList: 'blur',
                profileView: 'blur',
                avatar: 'blur',
                banner: 'blur',
                contentList: 'blur',
                contentView: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
                displayName: 'blur',
            },
            content: {
                contentList: 'blur',
                contentView: 'blur',
            },
        },
        locales: [],
    },
    '!no-unauthenticated': {
        identifier: '!no-unauthenticated',
        configurable: false,
        defaultSetting: 'hide',
        flags: ['no-override', 'unauthed'],
        severity: 'none',
        blurs: 'content',
        behaviors: {
            account: {
                profileList: 'blur',
                profileView: 'blur',
                avatar: 'blur',
                banner: 'blur',
                displayName: 'blur',
                contentList: 'blur',
                contentView: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
                displayName: 'blur',
            },
            content: {
                contentList: 'blur',
                contentView: 'blur',
            },
        },
        locales: [],
    },
    porn: {
        identifier: 'porn',
        configurable: true,
        defaultSetting: 'hide',
        flags: ['adult'],
        severity: 'none',
        blurs: 'media',
        behaviors: {
            account: {
                avatar: 'blur',
                banner: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
            },
            content: {
                contentMedia: 'blur',
            },
        },
        locales: [],
    },
    sexual: {
        identifier: 'sexual',
        configurable: true,
        defaultSetting: 'warn',
        flags: ['adult'],
        severity: 'none',
        blurs: 'media',
        behaviors: {
            account: {
                avatar: 'blur',
                banner: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
            },
            content: {
                contentMedia: 'blur',
            },
        },
        locales: [],
    },
    nudity: {
        identifier: 'nudity',
        configurable: true,
        defaultSetting: 'ignore',
        flags: [],
        severity: 'none',
        blurs: 'media',
        behaviors: {
            account: {
                avatar: 'blur',
                banner: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
            },
            content: {
                contentMedia: 'blur',
            },
        },
        locales: [],
    },
    'graphic-media': {
        identifier: 'graphic-media',
        flags: ['adult'],
        configurable: true,
        defaultSetting: 'warn',
        severity: 'none',
        blurs: 'media',
        behaviors: {
            account: {
                avatar: 'blur',
                banner: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
            },
            content: {
                contentMedia: 'blur',
            },
        },
        locales: [],
    },
    /** @deprecated alias for `graphic-media` */
    gore: {
        identifier: 'gore',
        flags: ['adult'],
        configurable: true,
        defaultSetting: 'warn',
        severity: 'none',
        blurs: 'media',
        behaviors: {
            account: {
                avatar: 'blur',
                banner: 'blur',
            },
            profile: {
                avatar: 'blur',
                banner: 'blur',
            },
            content: {
                contentMedia: 'blur',
            },
        },
        locales: [],
    },
};
//# sourceMappingURL=labels.js.map