"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretLabelValueDefinitions = exports.interpretLabelValueDefinition = exports.hasMutedWord = exports.ModerationDecision = exports.ModerationUI = void 0;
exports.moderateProfile = moderateProfile;
exports.moderatePost = moderatePost;
exports.moderateNotification = moderateNotification;
exports.moderateFeedGenerator = moderateFeedGenerator;
exports.moderateUserList = moderateUserList;
const account_1 = require("./subjects/account");
const profile_1 = require("./subjects/profile");
const notification_1 = require("./subjects/notification");
const post_1 = require("./subjects/post");
const feed_generator_1 = require("./subjects/feed-generator");
const user_list_1 = require("./subjects/user-list");
const decision_1 = require("./decision");
var ui_1 = require("./ui");
Object.defineProperty(exports, "ModerationUI", { enumerable: true, get: function () { return ui_1.ModerationUI; } });
var decision_2 = require("./decision");
Object.defineProperty(exports, "ModerationDecision", { enumerable: true, get: function () { return decision_2.ModerationDecision; } });
var mutewords_1 = require("./mutewords");
Object.defineProperty(exports, "hasMutedWord", { enumerable: true, get: function () { return mutewords_1.hasMutedWord; } });
var util_1 = require("./util");
Object.defineProperty(exports, "interpretLabelValueDefinition", { enumerable: true, get: function () { return util_1.interpretLabelValueDefinition; } });
Object.defineProperty(exports, "interpretLabelValueDefinitions", { enumerable: true, get: function () { return util_1.interpretLabelValueDefinitions; } });
function moderateProfile(subject, opts) {
    return decision_1.ModerationDecision.merge((0, account_1.decideAccount)(subject, opts), (0, profile_1.decideProfile)(subject, opts));
}
function moderatePost(subject, opts) {
    return (0, post_1.decidePost)(subject, opts);
}
function moderateNotification(subject, opts) {
    return (0, notification_1.decideNotification)(subject, opts);
}
function moderateFeedGenerator(subject, opts) {
    return (0, feed_generator_1.decideFeedGenerator)(subject, opts);
}
function moderateUserList(subject, opts) {
    return (0, user_list_1.decideUserList)(subject, opts);
}
//# sourceMappingURL=index.js.map