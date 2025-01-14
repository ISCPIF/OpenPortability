"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addHoursToDate = exports.lessThanAgoMs = exports.DAY = exports.HOUR = exports.MINUTE = exports.SECOND = void 0;
exports.SECOND = 1000;
exports.MINUTE = exports.SECOND * 60;
exports.HOUR = exports.MINUTE * 60;
exports.DAY = exports.HOUR * 24;
const lessThanAgoMs = (time, range) => {
    return Date.now() < time.getTime() + range;
};
exports.lessThanAgoMs = lessThanAgoMs;
const addHoursToDate = (hours, startingDate) => {
    // When date is passed, clone before calling `setHours()` so that we are not mutating the original date
    const currentDate = startingDate ? new Date(startingDate) : new Date();
    currentDate.setHours(currentDate.getHours() + hours);
    return currentDate;
};
exports.addHoursToDate = addHoursToDate;
//# sourceMappingURL=times.js.map