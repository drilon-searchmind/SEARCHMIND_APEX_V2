import dayjs from 'dayjs';

/** @param {string} startDate @param {string} endDate */
export function shareOfSearchMonthKeySet(startDate, endDate) {
    const set = new Set();
    let d = dayjs(startDate).startOf('month');
    const end = dayjs(endDate).endOf('month');
    while (d.isBefore(end) || d.isSame(end, 'month')) {
        set.add(d.format('YYYY-MM'));
        d = d.add(1, 'month');
    }
    return set;
}

/**
 * Keyword Planner sums whole calendar months — two ranges with the same month
 * set produce identical volumes/shares even if day-level dates differ.
 * @param {{ startDate: string, endDate: string }} a
 * @param {{ startDate: string, endDate: string }} b
 */
export function shareOfSearchSamePlannerMonths(a, b) {
    if (!a?.startDate || !b?.startDate) return false;
    const sa = shareOfSearchMonthKeySet(a.startDate, a.endDate);
    const sb = shareOfSearchMonthKeySet(b.startDate, b.endDate);
    if (sa.size !== sb.size) return false;
    for (const key of sa) {
        if (!sb.has(key)) return false;
    }
    return sa.size > 0;
}

/**
 * Default: equal-length window ending the day before the selected period starts.
 * When that window shares the same Planner months as YoY (~12mo reports), use
 * the equal-length window *before* the YoY range instead (non-overlapping).
 */
export function getShareOfSearchPreviousPeriodRange(startIso, endIso) {
    const start = dayjs(startIso);
    const end = dayjs(endIso);
    const days = end.diff(start, 'day') + 1;
    const naivePrevEnd = start.subtract(1, 'day');
    const naivePrevStart = naivePrevEnd.subtract(days - 1, 'day');
    const naive = {
        startDate: naivePrevStart.format('YYYY-MM-DD'),
        endDate: naivePrevEnd.format('YYYY-MM-DD'),
    };
    const ly = getShareOfSearchLastYearRange(startIso, endIso);
    if (shareOfSearchSamePlannerMonths(naive, ly)) {
        const prevEnd = dayjs(ly.startDate).subtract(1, 'day');
        const prevStart = prevEnd.subtract(days - 1, 'day');
        return {
            startDate: prevStart.format('YYYY-MM-DD'),
            endDate: prevEnd.format('YYYY-MM-DD'),
            definition: 'sequential_prior_year',
        };
    }
    return { ...naive, definition: 'immediate_prior' };
}

/** Same calendar window shifted back one year. */
export function getShareOfSearchLastYearRange(startIso, endIso) {
    return {
        startDate: dayjs(startIso).subtract(1, 'year').format('YYYY-MM-DD'),
        endDate: dayjs(endIso).subtract(1, 'year').format('YYYY-MM-DD'),
    };
}

export function areShareComparisonRangesEqual(prevRange, lyRange) {
    if (!prevRange || !lyRange) return false;
    if (
        String(prevRange.startDate) === String(lyRange.startDate) &&
        String(prevRange.endDate) === String(lyRange.endDate)
    ) {
        return true;
    }
    return shareOfSearchSamePlannerMonths(prevRange, lyRange);
}

export function mergeShareComparisonIntoRows(mainRows, previousPeriodRows, lastYearRows) {
    const prevMap = new Map((previousPeriodRows || []).map((r) => [r.brand, r.sharePct]));
    const lyMap = new Map((lastYearRows || []).map((r) => [r.brand, r.sharePct]));
    return (mainRows || []).map((r) => ({
        ...r,
        sharePctPreviousPeriod: prevMap.has(r.brand) ? prevMap.get(r.brand) : null,
        sharePctLastYear: lyMap.has(r.brand) ? lyMap.get(r.brand) : null,
    }));
}
