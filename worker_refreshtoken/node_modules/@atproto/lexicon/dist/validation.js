"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidRecord = assertValidRecord;
exports.assertValidXrpcParams = assertValidXrpcParams;
exports.assertValidXrpcInput = assertValidXrpcInput;
exports.assertValidXrpcOutput = assertValidXrpcOutput;
exports.assertValidXrpcMessage = assertValidXrpcMessage;
const complex_1 = require("./validators/complex");
const xrpc_1 = require("./validators/xrpc");
function assertValidRecord(lexicons, def, value) {
    const res = (0, complex_1.object)(lexicons, 'Record', def.record, value);
    if (!res.success)
        throw res.error;
    return res.value;
}
function assertValidXrpcParams(lexicons, def, value) {
    if (def.parameters) {
        const res = (0, xrpc_1.params)(lexicons, 'Params', def.parameters, value);
        if (!res.success)
            throw res.error;
        return res.value;
    }
}
function assertValidXrpcInput(lexicons, def, value) {
    if (def.input?.schema) {
        // loop: all input schema definitions
        return assertValidOneOf(lexicons, 'Input', def.input.schema, value, true);
    }
}
function assertValidXrpcOutput(lexicons, def, value) {
    if (def.output?.schema) {
        // loop: all output schema definitions
        return assertValidOneOf(lexicons, 'Output', def.output.schema, value, true);
    }
}
function assertValidXrpcMessage(lexicons, def, value) {
    if (def.message?.schema) {
        // loop: all output schema definitions
        return assertValidOneOf(lexicons, 'Message', def.message.schema, value, true);
    }
}
function assertValidOneOf(lexicons, path, def, value, mustBeObj = false) {
    const res = (0, complex_1.validateOneOf)(lexicons, path, def, value, mustBeObj);
    if (!res.success)
        throw res.error;
    return res.value;
}
//# sourceMappingURL=validation.js.map