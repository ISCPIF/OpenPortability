"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQuotedPost = isQuotedPost;
exports.isQuotedPostWithMedia = isQuotedPostWithMedia;
exports.interpretLabelValueDefinition = interpretLabelValueDefinition;
exports.interpretLabelValueDefinitions = interpretLabelValueDefinitions;
const client_1 = require("../client");
function isQuotedPost(embed) {
    return Boolean(embed && client_1.AppBskyEmbedRecord.isView(embed));
}
function isQuotedPostWithMedia(embed) {
    return Boolean(embed && client_1.AppBskyEmbedRecordWithMedia.isView(embed));
}
function interpretLabelValueDefinition(def, definedBy) {
    const behaviors = {
        account: {},
        profile: {},
        content: {},
    };
    const alertOrInform = def.severity === 'alert'
        ? 'alert'
        : def.severity === 'inform'
            ? 'inform'
            : undefined;
    if (def.blurs === 'content') {
        // target=account, blurs=content
        behaviors.account.profileList = alertOrInform;
        behaviors.account.profileView = alertOrInform;
        behaviors.account.contentList = 'blur';
        behaviors.account.contentView = def.adultOnly ? 'blur' : alertOrInform;
        // target=profile, blurs=content
        behaviors.profile.profileList = alertOrInform;
        behaviors.profile.profileView = alertOrInform;
        // target=content, blurs=content
        behaviors.content.contentList = 'blur';
        behaviors.content.contentView = def.adultOnly ? 'blur' : alertOrInform;
    }
    else if (def.blurs === 'media') {
        // target=account, blurs=media
        behaviors.account.profileList = alertOrInform;
        behaviors.account.profileView = alertOrInform;
        behaviors.account.avatar = 'blur';
        behaviors.account.banner = 'blur';
        // target=profile, blurs=media
        behaviors.profile.profileList = alertOrInform;
        behaviors.profile.profileView = alertOrInform;
        behaviors.profile.avatar = 'blur';
        behaviors.profile.banner = 'blur';
        // target=content, blurs=media
        behaviors.content.contentMedia = 'blur';
    }
    else if (def.blurs === 'none') {
        // target=account, blurs=none
        behaviors.account.profileList = alertOrInform;
        behaviors.account.profileView = alertOrInform;
        behaviors.account.contentList = alertOrInform;
        behaviors.account.contentView = alertOrInform;
        // target=profile, blurs=none
        behaviors.profile.profileList = alertOrInform;
        behaviors.profile.profileView = alertOrInform;
        // target=content, blurs=none
        behaviors.content.contentList = alertOrInform;
        behaviors.content.contentView = alertOrInform;
    }
    let defaultSetting = 'warn';
    if (def.defaultSetting === 'hide' || def.defaultSetting === 'ignore') {
        defaultSetting = def.defaultSetting;
    }
    const flags = ['no-self'];
    if (def.adultOnly) {
        flags.push('adult');
    }
    return {
        ...def,
        definedBy,
        configurable: true,
        defaultSetting,
        flags,
        behaviors,
    };
}
function interpretLabelValueDefinitions(labelerView) {
    return (labelerView.policies?.labelValueDefinitions || [])
        .filter((labelValDef) => client_1.ComAtprotoLabelDefs.validateLabelValueDefinition(labelValDef).success)
        .map((labelValDef) => interpretLabelValueDefinition(labelValDef, labelerView.creator.did));
}
//# sourceMappingURL=util.js.map