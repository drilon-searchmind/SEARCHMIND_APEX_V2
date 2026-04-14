import dayjs from 'dayjs';

/**
 * Same inclusive length as [startIso, endIso], ending the day before start.
 */
export function getShareOfSearchPreviousPeriodRange(startIso, endIso) {
    const start = dayjs(startIso);
    const end = dayjs(endIso);
    const days = end.diff(start, 'day') + 1;
    const prevEnd = start.subtract(1, 'day');
    const prevStart = prevEnd.subtract(days - 1, 'day');
    return {
        startDate: prevStart.format('YYYY-MM-DD'),
        endDate: prevEnd.format('YYYY-MM-DD'),
    };
}

/** Same calendar window shifted back one year. */
export function getShareOfSearchLastYearRange(startIso, endIso) {
    return {
        startDate: dayjs(startIso).subtract(1, 'year').format('YYYY-MM-DD'),
        endDate: dayjs(endIso).subtract(1, 'year').format('YYYY-MM-DD'),
    };
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
