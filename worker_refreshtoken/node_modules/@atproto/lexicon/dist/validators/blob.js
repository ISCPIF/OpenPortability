"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blob = blob;
const blob_refs_1 = require("../blob-refs");
const types_1 = require("../types");
function blob(lexicons, path, def, value) {
    // check
    if (!value || !(value instanceof blob_refs_1.BlobRef)) {
        return {
            success: false,
            error: new types_1.ValidationError(`${path} should be a blob ref`),
        };
    }
    return { success: true, value };
}
//# sourceMappingURL=blob.js.map