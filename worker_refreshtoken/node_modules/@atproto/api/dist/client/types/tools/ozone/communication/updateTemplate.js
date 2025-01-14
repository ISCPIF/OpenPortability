"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateTemplateNameError = void 0;
exports.toKnownErr = toKnownErr;
/**
 * GENERATED CODE - DO NOT MODIFY
 */
const xrpc_1 = require("@atproto/xrpc");
class DuplicateTemplateNameError extends xrpc_1.XRPCError {
    constructor(src) {
        super(src.status, src.error, src.message, src.headers, { cause: src });
    }
}
exports.DuplicateTemplateNameError = DuplicateTemplateNameError;
function toKnownErr(e) {
    if (e instanceof xrpc_1.XRPCError) {
        if (e.error === 'DuplicateTemplateName')
            return new DuplicateTemplateNameError(e);
    }
    return e;
}
//# sourceMappingURL=updateTemplate.js.map