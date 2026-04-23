/**
 * Apex Radar — per-customer targets / budget configuration (`customerApexRadarSettings`).
 * Pure helpers shared by the Facebook overview API and the overview UI.
 */

/** @typedef {{ spend: number, conversions: number, value: number, roas: number|null, ctrPct: number|null, freq: number|null }} RollupSlice */

export function getFacebookApexRadarSettings(customer) {
    const fb = customer?.customerApexRadarSettings?.facebook;
    if (!fb || typeof fb !== "object") {
        return {
            targetBudget: null,
            targetMetricType: "ROAS",
            targetValue: null,
            budgetMode: "DYNAMIC",
        };
    }
    const tb = fb.targetBudget;
    const tv = fb.targetValue;
    return {
        targetBudget: tb != null && tb !== "" && !Number.isNaN(Number(tb)) ? Number(tb) : null,
        targetMetricType: fb.targetMetricType === "CPA" ? "CPA" : "ROAS",
        targetValue: tv != null && tv !== "" && !Number.isNaN(Number(tv)) ? Number(tv) : null,
        budgetMode: fb.budgetMode === "STATIC" ? "STATIC" : "DYNAMIC",
    };
}

export function budgetModeToTableLabel(budgetMode) {
    return budgetMode === "STATIC" ? "S" : "D";
}

/**
 * Linear budget pace: realized MTD spend vs expected spend by the same calendar rule as the spec —
 * expected = (targetBudget / daysInMonth) * (dayOfMonth - 1), as-of `asOfDateIso`.
 * @returns {number|null} ratio realized / expected, or null if undefined
 */
export function computeBudgetLinearPace(realizedBudget, targetBudget, asOfDateIso) {
    if (
        targetBudget == null ||
        targetBudget <= 0 ||
        realizedBudget == null ||
        !asOfDateIso ||
        typeof asOfDateIso !== "string"
    ) {
        return null;
    }
    const parts = asOfDateIso.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (!y || !m || !d) return null;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dayOfMonth = d;
    const expectedToDate = (targetBudget / daysInMonth) * Math.max(0, dayOfMonth - 1);
    if (expectedToDate <= 0) return null;
    return realizedBudget / expectedToDate;
}

/** ROAS mode: sum of conversion value. CPA mode: sum of conversions (purchase actions). */
export function displayValueMetricFromRollup(rollup, targetMetricType) {
    if (!rollup) return null;
    if (targetMetricType === "CPA") {
        const c = rollup.conversions;
        return c != null ? c : null;
    }
    const v = rollup.value;
    return v != null ? v : null;
}

export function rollupToCpa(rollup) {
    if (!rollup) return null;
    const conv = rollup.conversions;
    if (conv == null || conv <= 0) return null;
    const spend = rollup.spend;
    if (spend == null) return null;
    return spend / conv;
}

function emptyAlertsBase() {
    return {
        value7dBelowMin: false,
        value30dBelowMin: false,
        target7dMiss: false,
        target30dMiss: false,
        budgetPaceOff: false,
        highAdFatigue: false,
    };
}

/**
 * Targets + budget columns + alert flags derived from Meta rollups and saved Apex settings.
 * @param {object} customer
 * @param {RollupSlice} r7
 * @param {RollupSlice} r30
 * @param {object} [opts]
 * @param {number|null} [opts.spendOnAsOfDate] — spend on the overview end date (single day; UI label "yesterday" when range ends there)
 * @param {number|null} [opts.realizedBudgetMonthToDate] — spend from calendar month start through as-of date inclusive
 * @param {string|null} [opts.asOfDate] — YYYY-MM-DD (overview endDate) for linear pace divisor
 * @param {number|null} [opts.displayValue7d] — Value (7d) column: conv. value sum if ROAS, conversion count if CPA
 * @param {number|null} [opts.displayValue30d]
 * @param {number|null} [opts.minExpected7d] — 10^(mean log10 weekly − 2·std)
 * @param {number|null} [opts.minExpected30d] — 10^(mean log10 weekly − std)
 */
export function buildFacebookOverviewTargetsBudgetAlerts(customer, r7, r30, opts = {}) {
    const apex = getFacebookApexRadarSettings(customer);
    const {
        spendOnAsOfDate = null,
        realizedBudgetMonthToDate = null,
        asOfDate = null,
        displayValue7d = null,
        displayValue30d = null,
        minExpected7d = null,
        minExpected30d = null,
    } = opts;

    let actual7d = null;
    let actual30d = null;
    if (apex.targetMetricType === "CPA") {
        actual7d = rollupToCpa(r7);
        actual30d = rollupToCpa(r30);
    } else {
        actual7d = r7?.roas != null ? r7.roas : null;
        actual30d = r30?.roas != null ? r30.roas : null;
    }

    const realizedBudget = realizedBudgetMonthToDate;
    let budgetPace = null;
    if (apex.targetBudget != null && apex.targetBudget > 0 && realizedBudget != null && asOfDate) {
        budgetPace = computeBudgetLinearPace(realizedBudget, apex.targetBudget, asOfDate);
    }

    const alerts = emptyAlertsBase();
    const tv = apex.targetValue;
    if (tv != null && actual7d != null) {
        alerts.target7dMiss =
            apex.targetMetricType === "ROAS" ? actual7d < tv : actual7d > tv;
    }
    if (tv != null && actual30d != null) {
        alerts.target30dMiss =
            apex.targetMetricType === "ROAS" ? actual30d < tv : actual30d > tv;
    }
    if (budgetPace != null) {
        alerts.budgetPaceOff = budgetPace < 0.9 || budgetPace > 1.1;
    }
    if (minExpected7d != null && displayValue7d != null) {
        alerts.value7dBelowMin = displayValue7d < minExpected7d;
    }
    if (minExpected30d != null && displayValue30d != null) {
        alerts.value30dBelowMin = displayValue30d < minExpected30d;
    }

    return {
        targets: {
            targetType: apex.targetMetricType,
            target: apex.targetValue,
            actual7d,
            actual30d,
        },
        budget: {
            targetBudget: apex.targetBudget,
            realizedBudget,
            spendYesterday: spendOnAsOfDate,
            budgetPace,
            budgetType: budgetModeToTableLabel(apex.budgetMode),
        },
        alerts,
    };
}

/**
 * Row slice for customers without Meta data (no ad account / error): only configured targets & budget type.
 */
export function buildFacebookOverviewApexOnlySlice(customer) {
    const apex = getFacebookApexRadarSettings(customer);
    return {
        targets: {
            targetType: apex.targetMetricType,
            target: apex.targetValue,
            actual7d: null,
            actual30d: null,
        },
        budget: {
            targetBudget: apex.targetBudget,
            realizedBudget: null,
            spendYesterday: null,
            budgetPace: null,
            budgetType: budgetModeToTableLabel(apex.budgetMode),
        },
        alerts: emptyAlertsBase(),
    };
}
