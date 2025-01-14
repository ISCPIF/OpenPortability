"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideFeedGenerator = decideFeedGenerator;
const decision_1 = require("../decision");
const account_1 = require("./account");
const profile_1 = require("./profile");
function decideFeedGenerator(subject, opts) {
    const acc = new decision_1.ModerationDecision();
    acc.setDid(subject.creator.did);
    acc.setIsMe(subject.creator.did === opts.userDid);
    if (subject.labels?.length) {
        for (const label of subject.labels) {
            acc.addLabel('content', label, opts);
        }
    }
    return decision_1.ModerationDecision.merge(acc, (0, account_1.decideAccount)(subject.creator, opts), (0, profile_1.decideProfile)(subject.creator, opts));
}
//# sourceMappingURL=feed-generator.js.map