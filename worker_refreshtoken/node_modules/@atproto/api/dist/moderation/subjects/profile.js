"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideProfile = decideProfile;
exports.filterProfileLabels = filterProfileLabels;
const decision_1 = require("../decision");
function decideProfile(subject, opts) {
    const acc = new decision_1.ModerationDecision();
    acc.setDid(subject.did);
    acc.setIsMe(subject.did === opts.userDid);
    for (const label of filterProfileLabels(subject.labels)) {
        acc.addLabel('profile', label, opts);
    }
    return acc;
}
function filterProfileLabels(labels) {
    if (!labels) {
        return [];
    }
    return labels.filter((label) => label.uri.endsWith('/app.bsky.actor.profile/self'));
}
//# sourceMappingURL=profile.js.map