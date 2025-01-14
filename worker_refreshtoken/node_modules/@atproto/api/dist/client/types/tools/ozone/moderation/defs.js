"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEWNONE = exports.REVIEWCLOSED = exports.REVIEWESCALATED = exports.REVIEWOPEN = void 0;
exports.isModEventView = isModEventView;
exports.validateModEventView = validateModEventView;
exports.isModEventViewDetail = isModEventViewDetail;
exports.validateModEventViewDetail = validateModEventViewDetail;
exports.isSubjectStatusView = isSubjectStatusView;
exports.validateSubjectStatusView = validateSubjectStatusView;
exports.isModEventTakedown = isModEventTakedown;
exports.validateModEventTakedown = validateModEventTakedown;
exports.isModEventReverseTakedown = isModEventReverseTakedown;
exports.validateModEventReverseTakedown = validateModEventReverseTakedown;
exports.isModEventResolveAppeal = isModEventResolveAppeal;
exports.validateModEventResolveAppeal = validateModEventResolveAppeal;
exports.isModEventComment = isModEventComment;
exports.validateModEventComment = validateModEventComment;
exports.isModEventReport = isModEventReport;
exports.validateModEventReport = validateModEventReport;
exports.isModEventLabel = isModEventLabel;
exports.validateModEventLabel = validateModEventLabel;
exports.isModEventAcknowledge = isModEventAcknowledge;
exports.validateModEventAcknowledge = validateModEventAcknowledge;
exports.isModEventEscalate = isModEventEscalate;
exports.validateModEventEscalate = validateModEventEscalate;
exports.isModEventMute = isModEventMute;
exports.validateModEventMute = validateModEventMute;
exports.isModEventUnmute = isModEventUnmute;
exports.validateModEventUnmute = validateModEventUnmute;
exports.isModEventMuteReporter = isModEventMuteReporter;
exports.validateModEventMuteReporter = validateModEventMuteReporter;
exports.isModEventUnmuteReporter = isModEventUnmuteReporter;
exports.validateModEventUnmuteReporter = validateModEventUnmuteReporter;
exports.isModEventEmail = isModEventEmail;
exports.validateModEventEmail = validateModEventEmail;
exports.isModEventDivert = isModEventDivert;
exports.validateModEventDivert = validateModEventDivert;
exports.isModEventTag = isModEventTag;
exports.validateModEventTag = validateModEventTag;
exports.isAccountEvent = isAccountEvent;
exports.validateAccountEvent = validateAccountEvent;
exports.isIdentityEvent = isIdentityEvent;
exports.validateIdentityEvent = validateIdentityEvent;
exports.isRecordEvent = isRecordEvent;
exports.validateRecordEvent = validateRecordEvent;
exports.isRepoView = isRepoView;
exports.validateRepoView = validateRepoView;
exports.isRepoViewDetail = isRepoViewDetail;
exports.validateRepoViewDetail = validateRepoViewDetail;
exports.isRepoViewNotFound = isRepoViewNotFound;
exports.validateRepoViewNotFound = validateRepoViewNotFound;
exports.isRecordView = isRecordView;
exports.validateRecordView = validateRecordView;
exports.isRecordViewDetail = isRecordViewDetail;
exports.validateRecordViewDetail = validateRecordViewDetail;
exports.isRecordViewNotFound = isRecordViewNotFound;
exports.validateRecordViewNotFound = validateRecordViewNotFound;
exports.isModeration = isModeration;
exports.validateModeration = validateModeration;
exports.isModerationDetail = isModerationDetail;
exports.validateModerationDetail = validateModerationDetail;
exports.isBlobView = isBlobView;
exports.validateBlobView = validateBlobView;
exports.isImageDetails = isImageDetails;
exports.validateImageDetails = validateImageDetails;
exports.isVideoDetails = isVideoDetails;
exports.validateVideoDetails = validateVideoDetails;
exports.isAccountHosting = isAccountHosting;
exports.validateAccountHosting = validateAccountHosting;
exports.isRecordHosting = isRecordHosting;
exports.validateRecordHosting = validateRecordHosting;
const util_1 = require("../../../../util");
const lexicons_1 = require("../../../../lexicons");
function isModEventView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventView');
}
function validateModEventView(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventView', v);
}
function isModEventViewDetail(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventViewDetail');
}
function validateModEventViewDetail(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventViewDetail', v);
}
function isSubjectStatusView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#subjectStatusView');
}
function validateSubjectStatusView(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#subjectStatusView', v);
}
/** Moderator review status of a subject: Open. Indicates that the subject needs to be reviewed by a moderator */
exports.REVIEWOPEN = 'tools.ozone.moderation.defs#reviewOpen';
/** Moderator review status of a subject: Escalated. Indicates that the subject was escalated for review by a moderator */
exports.REVIEWESCALATED = 'tools.ozone.moderation.defs#reviewEscalated';
/** Moderator review status of a subject: Closed. Indicates that the subject was already reviewed and resolved by a moderator */
exports.REVIEWCLOSED = 'tools.ozone.moderation.defs#reviewClosed';
/** Moderator review status of a subject: Unnecessary. Indicates that the subject does not need a review at the moment but there is probably some moderation related metadata available for it */
exports.REVIEWNONE = 'tools.ozone.moderation.defs#reviewNone';
function isModEventTakedown(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventTakedown');
}
function validateModEventTakedown(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventTakedown', v);
}
function isModEventReverseTakedown(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventReverseTakedown');
}
function validateModEventReverseTakedown(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventReverseTakedown', v);
}
function isModEventResolveAppeal(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventResolveAppeal');
}
function validateModEventResolveAppeal(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventResolveAppeal', v);
}
function isModEventComment(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventComment');
}
function validateModEventComment(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventComment', v);
}
function isModEventReport(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventReport');
}
function validateModEventReport(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventReport', v);
}
function isModEventLabel(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventLabel');
}
function validateModEventLabel(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventLabel', v);
}
function isModEventAcknowledge(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventAcknowledge');
}
function validateModEventAcknowledge(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventAcknowledge', v);
}
function isModEventEscalate(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventEscalate');
}
function validateModEventEscalate(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventEscalate', v);
}
function isModEventMute(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventMute');
}
function validateModEventMute(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventMute', v);
}
function isModEventUnmute(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventUnmute');
}
function validateModEventUnmute(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventUnmute', v);
}
function isModEventMuteReporter(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventMuteReporter');
}
function validateModEventMuteReporter(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventMuteReporter', v);
}
function isModEventUnmuteReporter(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventUnmuteReporter');
}
function validateModEventUnmuteReporter(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventUnmuteReporter', v);
}
function isModEventEmail(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventEmail');
}
function validateModEventEmail(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventEmail', v);
}
function isModEventDivert(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventDivert');
}
function validateModEventDivert(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventDivert', v);
}
function isModEventTag(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#modEventTag');
}
function validateModEventTag(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#modEventTag', v);
}
function isAccountEvent(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#accountEvent');
}
function validateAccountEvent(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#accountEvent', v);
}
function isIdentityEvent(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#identityEvent');
}
function validateIdentityEvent(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#identityEvent', v);
}
function isRecordEvent(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#recordEvent');
}
function validateRecordEvent(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#recordEvent', v);
}
function isRepoView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#repoView');
}
function validateRepoView(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#repoView', v);
}
function isRepoViewDetail(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#repoViewDetail');
}
function validateRepoViewDetail(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#repoViewDetail', v);
}
function isRepoViewNotFound(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#repoViewNotFound');
}
function validateRepoViewNotFound(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#repoViewNotFound', v);
}
function isRecordView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#recordView');
}
function validateRecordView(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#recordView', v);
}
function isRecordViewDetail(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#recordViewDetail');
}
function validateRecordViewDetail(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#recordViewDetail', v);
}
function isRecordViewNotFound(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#recordViewNotFound');
}
function validateRecordViewNotFound(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#recordViewNotFound', v);
}
function isModeration(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#moderation');
}
function validateModeration(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#moderation', v);
}
function isModerationDetail(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#moderationDetail');
}
function validateModerationDetail(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#moderationDetail', v);
}
function isBlobView(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#blobView');
}
function validateBlobView(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#blobView', v);
}
function isImageDetails(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#imageDetails');
}
function validateImageDetails(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#imageDetails', v);
}
function isVideoDetails(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#videoDetails');
}
function validateVideoDetails(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#videoDetails', v);
}
function isAccountHosting(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#accountHosting');
}
function validateAccountHosting(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#accountHosting', v);
}
function isRecordHosting(v) {
    return ((0, util_1.isObj)(v) &&
        (0, util_1.hasProp)(v, '$type') &&
        v.$type === 'tools.ozone.moderation.defs#recordHosting');
}
function validateRecordHosting(v) {
    return lexicons_1.lexicons.validate('tools.ozone.moderation.defs#recordHosting', v);
}
//# sourceMappingURL=defs.js.map