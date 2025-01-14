"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideAccount = decideAccount;
exports.filterAccountLabels = filterAccountLabels;
const decision_1 = require("../decision");
function decideAccount(subject, opts) {
    const acc = new decision_1.ModerationDecision();
    acc.setDid(subject.did);
    acc.setIsMe(subject.did === opts.userDid);
    if (subject.viewer?.muted) {
        if (subject.viewer?.mutedByList) {
            acc.addMutedByList(subject.viewer?.mutedByList);
        }
        else {
            acc.addMuted(subject.viewer?.muted);
        }
    }
    if (subject.viewer?.blocking) {
        if (subject.viewer?.blockingByList) {
            acc.addBlockingByList(subject.viewer?.blockingByList);
        }
        else {
            acc.addBlocking(subject.viewer?.blocking);
        }
    }
    acc.addBlockedBy(subject.viewer?.blockedBy);
    for (const label of filterAccountLabels(subject.labels)) {
        acc.addLabel('account', label, opts);
    }
    return acc;
}
function filterAccountLabels(labels) {
    if (!labels) {
        return [];
    }
    return labels.filter((label) => !label.uri.endsWith('/app.bsky.actor.profile/self') ||
        label.val === '!no-unauthenticated');
}
//# sourceMappingURL=account.js.map