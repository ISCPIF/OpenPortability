"use strict";
// Explicitly not using "zod" types here to avoid mismatching types due to
// version differences.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObject = exports.assure = exports.create = exports.is = void 0;
const is = (obj, def) => {
    return def.safeParse(obj).success;
};
exports.is = is;
const create = (def) => (v) => def.safeParse(v).success;
exports.create = create;
const assure = (def, obj) => {
    return def.parse(obj);
};
exports.assure = assure;
const isObject = (obj) => {
    return typeof obj === 'object' && obj !== null;
};
exports.isObject = isObject;
//# sourceMappingURL=check.js.map