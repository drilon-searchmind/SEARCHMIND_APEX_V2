import dayjs from "dayjs";

export const DATE_FORMAT = "YYYY-MM-DD";

/** Internal comparison method values (stored in app state / API). */
export const COMPARISON_METHOD = {
    LAST_PERIOD: "Last Period",
    LAST_YEAR: "Last Year",
    PREVIOUS_MONTH: "Previous Month",
    NONE: "None",
    CUSTOM: "Custom",
};

/** Default dashboard range: month start → yesterday (or today if 1st of month). */
export function getDefaultDashboardDateRange(ref = dayjs()) {
    const today = ref;
    const isFirst = today.date() === 1;
    return {
        startDate: today.startOf("month").format(DATE_FORMAT),
        endDate: (isFirst ? today : today.subtract(1, "day")).format(DATE_FORMAT),
    };
}

export const DATE_RANGE_PRESETS = [
    {
        id: "last7",
        label: "Last 7 days",
        getRange: () => ({
            start: dayjs().subtract(6, "day"),
            end: dayjs(),
        }),
    },
    {
        id: "last30",
        label: "Last 30 days",
        getRange: () => ({
            start: dayjs().subtract(29, "day"),
            end: dayjs(),
        }),
    },
    {
        id: "mtd",
        label: "Month to date",
        getRange: () => {
            const today = dayjs();
            const isFirst = today.date() === 1;
            return {
                start: today.startOf("month"),
                end: isFirst ? today : today.subtract(1, "day"),
            };
        },
    },
    {
        id: "qtd",
        label: "Quarter to date",
        getRange: () => {
            const today = dayjs();
            const isFirst = today.date() === 1;
            return {
                start: today.startOf("quarter"),
                end: isFirst ? today : today.subtract(1, "day"),
            };
        },
    },
    {
        id: "ytd",
        label: "Year to date",
        getRange: () => {
            const today = dayjs();
            const isFirst = today.date() === 1;
            return {
                start: today.startOf("year"),
                end: isFirst ? today : today.subtract(1, "day"),
            };
        },
    },
    { id: "custom", label: "Custom" },
];

export const COMPARE_PRESETS = [
    {
        id: "previous_period",
        label: "Previous period",
        method: COMPARISON_METHOD.LAST_PERIOD,
    },
    {
        id: "yoy",
        label: "Year over year",
        method: COMPARISON_METHOD.LAST_YEAR,
    },
    {
        id: "previous_month",
        label: "Previous month",
        method: COMPARISON_METHOD.PREVIOUS_MONTH,
    },
    { id: "none", label: "No comparison", method: COMPARISON_METHOD.NONE },
    { id: "custom", label: "Custom", method: COMPARISON_METHOD.CUSTOM },
];

export function formatRangeLabel(startDate, endDate) {
    if (!startDate || !endDate) return "Select date range";
    return `${startDate} to ${endDate}`;
}

/**
 * Resolve comparison period for fetching previous-period data.
 * @returns {{ skip: boolean, prevStart: import('dayjs').Dayjs | null, prevEnd: import('dayjs').Dayjs | null }}
 */
export function getComparisonPeriodRange({
    comparisonMethod,
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
}) {
    if (!startDate || !endDate) {
        return { skip: true, prevStart: null, prevEnd: null };
    }
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (!start.isValid() || !end.isValid()) {
        return { skip: true, prevStart: null, prevEnd: null };
    }

    if (comparisonMethod === COMPARISON_METHOD.NONE || !comparisonMethod) {
        return { skip: true, prevStart: null, prevEnd: null };
    }

    if (
        comparisonMethod === COMPARISON_METHOD.CUSTOM &&
        compareStartDate &&
        compareEndDate
    ) {
        const cs = dayjs(compareStartDate);
        const ce = dayjs(compareEndDate);
        if (cs.isValid() && ce.isValid()) {
            return { skip: false, prevStart: cs, prevEnd: ce };
        }
    }

    if (comparisonMethod === COMPARISON_METHOD.LAST_YEAR) {
        return {
            skip: false,
            prevStart: start.subtract(1, "year"),
            prevEnd: end.subtract(1, "year"),
        };
    }

    if (comparisonMethod === COMPARISON_METHOD.PREVIOUS_MONTH) {
        return {
            skip: false,
            prevStart: start.subtract(1, "month"),
            prevEnd: end.subtract(1, "month"),
        };
    }

    const days = end.diff(start, "day") + 1;
    const prevEnd = start.subtract(1, "day");
    return {
        skip: false,
        prevStart: prevEnd.subtract(days - 1, "day"),
        prevEnd,
    };
}

/** Comparison period as formatted strings for API fetch URLs. */
export function formatComparisonPeriodDates(opts) {
    const comp = getComparisonPeriodRange(opts);
    if (comp.skip || !comp.prevStart || !comp.prevEnd) {
        return { skip: true, startDate: null, endDate: null };
    }
    return {
        skip: false,
        startDate: comp.prevStart.format(DATE_FORMAT),
        endDate: comp.prevEnd.format(DATE_FORMAT),
    };
}

/** Map a daily chart category date to the matching comparison-period date key. */
export function resolveDailyComparisonDate({
    comparisonMethod,
    currentDate,
    appliedStartDate,
    appliedEndDate,
    sortedPrevKeys = [],
}) {
    const categoryIndex = dayjs(currentDate).diff(dayjs(appliedStartDate), "day");
    return resolveChartCategoryPrevKey({
        comparisonMethod,
        categoryKey: currentDate,
        categoryIndex,
        aggregateBy: "period",
        appliedStartDate,
        appliedEndDate,
        sortedPrevKeys,
    });
}

/** Preview comparison range labels for footer (before Apply). */
export function getComparisonPreviewRange({
    comparisonMethod,
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
}) {
    const { skip, prevStart, prevEnd } = getComparisonPeriodRange({
        comparisonMethod,
        startDate,
        endDate,
        compareStartDate,
        compareEndDate,
    });
    if (skip || !prevStart || !prevEnd) return null;
    return {
        startDate: prevStart.format(DATE_FORMAT),
        endDate: prevEnd.format(DATE_FORMAT),
    };
}

/** Match applied dates to a preset id, or "custom". */
export function detectDateRangePresetId(startDate, endDate) {
    if (!startDate || !endDate) return "custom";
    for (const preset of DATE_RANGE_PRESETS) {
        if (preset.id === "custom" || !preset.getRange) continue;
        const { start, end } = preset.getRange();
        if (
            start.format(DATE_FORMAT) === startDate &&
            end.format(DATE_FORMAT) === endDate
        ) {
            return preset.id;
        }
    }
    return "custom";
}

export function comparisonMethodToPresetId(method) {
    const found = COMPARE_PRESETS.find((p) => p.method === method);
    return found?.id ?? "yoy";
}

export function presetIdToComparisonMethod(presetId) {
    const found = COMPARE_PRESETS.find((p) => p.id === presetId);
    return found?.method ?? COMPARISON_METHOD.LAST_YEAR;
}

export function isValidDateRange(startDate, endDate) {
    if (!startDate || !endDate) return false;
    const s = dayjs(startDate);
    const e = dayjs(endDate);
    return s.isValid() && e.isValid() && !e.isBefore(s, "day");
}

/** Human-readable comparison label for charts / popovers. */
export function getComparisonMethodLabel(method) {
    const preset = COMPARE_PRESETS.find((p) => p.method === method);
    return preset?.label ?? method ?? "";
}

/**
 * Resolve previous-period chart key from a current category key (explicit API for chart .map callbacks).
 * Use `categoryKey` (not shorthand `currKey`) to avoid ReferenceError when the loop variable is `k`.
 */
export function resolveChartCategoryPrevKey({
    comparisonMethod,
    categoryKey,
    categoryIndex,
    aggregateBy,
    appliedStartDate,
    appliedEndDate,
    sortedPrevKeys = [],
}) {
    return getPrevKeyForChartCategory({
        comparisonMethod,
        currKey: categoryKey,
        categoryIndex,
        aggregateBy,
        appliedStartDate,
        appliedEndDate,
        sortedPrevKeys,
    });
}

/**
 * Map a current-period chart category key to the comparison period bucket key.
 * @param {string[]} sortedPrevKeys — sorted keys from aggregated previous-period data
 */
export function getPrevKeyForChartCategory({
    comparisonMethod,
    currKey,
    categoryIndex,
    aggregateBy,
    appliedStartDate,
    appliedEndDate,
    sortedPrevKeys = [],
}) {
    if (comparisonMethod === COMPARISON_METHOD.NONE || !comparisonMethod) {
        return null;
    }
    if (comparisonMethod === COMPARISON_METHOD.CUSTOM) {
        return sortedPrevKeys[categoryIndex] ?? null;
    }
    if (aggregateBy === "monthly") {
        if (comparisonMethod === COMPARISON_METHOD.LAST_YEAR) {
            return dayjs(`${currKey}-01`).subtract(1, "year").format("YYYY-MM");
        }
        if (comparisonMethod === COMPARISON_METHOD.PREVIOUS_MONTH) {
            return dayjs(`${currKey}-01`).subtract(1, "month").format("YYYY-MM");
        }
        const periodStartMonth = dayjs(appliedStartDate).startOf("month");
        const prevPeriodEnd = periodStartMonth.subtract(1, "day").endOf("month");
        const prevPeriodStart = prevPeriodEnd.startOf("month");
        return prevPeriodStart.add(categoryIndex, "month").format("YYYY-MM");
    }
    if (comparisonMethod === COMPARISON_METHOD.LAST_YEAR) {
        return dayjs(currKey).subtract(1, "year").format(DATE_FORMAT);
    }
    if (comparisonMethod === COMPARISON_METHOD.PREVIOUS_MONTH) {
        return dayjs(currKey).subtract(1, "month").format(DATE_FORMAT);
    }
    const daysInRange =
        dayjs(appliedEndDate).diff(dayjs(appliedStartDate), "day") + 1;
    const prevStart = dayjs(appliedStartDate).subtract(daysInRange, "day");
    return prevStart.add(categoryIndex, "day").format(DATE_FORMAT);
}
