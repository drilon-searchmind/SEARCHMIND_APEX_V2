const MONTH_OF_YEAR = {
    JANUARY: 1,
    FEBRUARY: 2,
    MARCH: 3,
    APRIL: 4,
    MAY: 5,
    JUNE: 6,
    JULY: 7,
    AUGUST: 8,
    SEPTEMBER: 9,
    OCTOBER: 10,
    NOVEMBER: 11,
    DECEMBER: 12,
};

/** @param {Record<string, unknown>|null|undefined} m */
export function parseMonthKey(m) {
    if (!m) return null;
    const y = Number(m.year);
    let mon = m.month;
    if (typeof mon === "string") mon = MONTH_OF_YEAR[mon.toUpperCase()];
    if (!y || !mon) return null;
    return `${y}-${String(mon).padStart(2, "0")}`;
}
