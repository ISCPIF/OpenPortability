"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideNotification = decideNotification;
const decision_1 = require("../decision");
const account_1 = require("./account");
const profile_1 = require("./profile");
function decideNotification(subject, opts) {
    const acc = new decision_1.ModerationDecision();
    acc.setDid(subject.author.did);
    acc.setIsMe(subject.author.did === opts.userDid);
    if (subject.labels?.length) {
        for (const label of subject.labels) {
            acc.addLabel('content', label, opts);
        }
    }
    return decision_1.ModerationDecision.merge(acc, (0, account_1.decideAccount)(subject.author, opts), (0, profile_1.decideProfile)(subject.author, opts));
}
//# sourceMappingURL=notification.js.map