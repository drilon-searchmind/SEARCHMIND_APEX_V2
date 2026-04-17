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
 * @param {number|null} yesterdaySpend
 */
export function buildFacebookOverviewTargetsBudgetAlerts(customer, r7, r30, yesterdaySpend) {
    const apex = getFacebookApexRadarSettings(customer);

    let actual7d = null;
    let actual30d = null;
    if (apex.targetMetricType === "CPA") {
        actual7d = rollupToCpa(r7);
        actual30d = rollupToCpa(r30);
    } else {
        actual7d = r7?.roas != null ? r7.roas : null;
        actual30d = r30?.roas != null ? r30.roas : null;
    }

    const realizedBudget = r30?.spend != null ? r30.spend : null;
    let budgetPace = null;
    if (apex.targetBudget != null && apex.targetBudget > 0 && realizedBudget != null) {
        budgetPace = realizedBudget / apex.targetBudget;
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
            spendYesterday: yesterdaySpend,
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
