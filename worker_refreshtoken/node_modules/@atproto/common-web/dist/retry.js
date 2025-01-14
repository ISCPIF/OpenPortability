"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = retry;
exports.createRetryable = createRetryable;
exports.backoffMs = backoffMs;
const util_1 = require("./util");
async function retry(fn, opts = {}) {
    const { maxRetries = 3, retryable = () => true, getWaitMs = backoffMs } = opts;
    let retries = 0;
    let doneError;
    while (!doneError) {
        try {
            return await fn();
        }
        catch (err) {
            const waitMs = getWaitMs(retries);
            const willRetry = retries < maxRetries && waitMs !== null && retryable(err);
            if (willRetry) {
                retries += 1;
                if (waitMs !== 0) {
                    await (0, util_1.wait)(waitMs);
                }
            }
            else {
                doneError = err;
            }
        }
    }
    throw doneError;
}
function createRetryable(retryable) {
    return async (fn, opts) => retry(fn, { ...opts, retryable });
}
// Waits exponential backoff with max and jitter: ~100, ~200, ~400, ~800, ~1000, ~1000, ...
function backoffMs(n, multiplier = 100, max = 1000) {
    const exponentialMs = Math.pow(2, n) * multiplier;
    const ms = Math.min(exponentialMs, max);
    return jitter(ms);
}
// Adds randomness +/-15% of value
function jitter(value) {
    const delta = value * 0.15;
    return value + randomRange(-delta, delta);
}
function randomRange(from, to) {
    const rand = Math.random() * (to - from);
    return rand + from;
}
//# sourceMappingURL=retry.js.map