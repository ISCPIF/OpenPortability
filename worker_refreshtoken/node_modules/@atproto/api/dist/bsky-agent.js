"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BskyAgent = void 0;
const atp_agent_1 = require("./atp-agent");
/** @deprecated use {@link AtpAgent} instead */
class BskyAgent extends atp_agent_1.AtpAgent {
    clone() {
        if (this.constructor === BskyAgent) {
            const agent = new BskyAgent(this.sessionManager);
            return this.copyInto(agent);
        }
        // sub-classes should override this method
        throw new TypeError('Cannot clone a subclass of BskyAgent');
    }
}
exports.BskyAgent = BskyAgent;
//# sourceMappingURL=bsky-agent.js.map