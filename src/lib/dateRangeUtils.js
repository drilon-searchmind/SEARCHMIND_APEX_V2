/** Inclusive list of YYYY-MM-DD between start and end. */
export function eachDayInRange(startDateStr, endDateStr) {
    const out = [];
    const start = new Date(`${startDateStr}T12:00:00`);
    const end = new Date(`${endDateStr}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return out;
    }
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
}
