"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideUserList = decideUserList;
const syntax_1 = require("@atproto/syntax");
const decision_1 = require("../decision");
const account_1 = require("./account");
const profile_1 = require("./profile");
function decideUserList(subject, opts) {
    const acc = new decision_1.ModerationDecision();
    const creator = isProfile(subject.creator) ? subject.creator : undefined;
    if (creator) {
        acc.setDid(creator.did);
        acc.setIsMe(creator.did === opts.userDid);
        if (subject.labels?.length) {
            for (const label of subject.labels) {
                acc.addLabel('content', label, opts);
            }
        }
        return decision_1.ModerationDecision.merge(acc, (0, account_1.decideAccount)(creator, opts), (0, profile_1.decideProfile)(creator, opts));
    }
    const creatorDid = new syntax_1.AtUri(subject.uri).hostname;
    acc.setDid(creatorDid);
    acc.setIsMe(creatorDid === opts.userDid);
    if (subject.labels?.length) {
        for (const label of subject.labels) {
            acc.addLabel('content', label, opts);
        }
    }
    return acc;
}
function isProfile(v) {
    return v && typeof v === 'object' && 'did' in v;
}
//# sourceMappingURL=user-list.js.map