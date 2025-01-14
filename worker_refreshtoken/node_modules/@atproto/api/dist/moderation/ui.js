"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationUI = void 0;
class ModerationUI {
    constructor() {
        Object.defineProperty(this, "noOverride", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "filters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "blurs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "alerts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "informs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    get filter() {
        return this.filters.length !== 0;
    }
    get blur() {
        return this.blurs.length !== 0;
    }
    get alert() {
        return this.alerts.length !== 0;
    }
    get inform() {
        return this.informs.length !== 0;
    }
}
exports.ModerationUI = ModerationUI;
//# sourceMappingURL=ui.js.map