"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLETRIAGE = exports.ROLEMODERATOR = exports.ROLEADMIN = void 0;
exports.isMember = isMember;
exports.validateMember = validateMember;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isMember(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.team.defs#member');
}
function validateMember(v) {
    return lexicons_1.lexicons.validate('tools.ozone.team.defs#member', v);
}
/** Admin role. Highest level of access, can perform all actions. */
exports.ROLEADMIN = 'tools.ozone.team.defs#roleAdmin';
/** Moderator role. Can perform most actions. */
exports.ROLEMODERATOR = 'tools.ozone.team.defs#roleModerator';
/** Triage role. Mostly intended for monitoring and escalating issues. */
exports.ROLETRIAGE = 'tools.ozone.team.defs#roleTriage';
//# sourceMappingURL=defs.js.map