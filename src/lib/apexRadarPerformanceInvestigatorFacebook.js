/**
 * Apex Radar Performance Investigator — Facebook account insights (monthly + range aggregates).
 */

const GRAPH_VERSION = "v21.0";

function parseMetaIdFilter(includeStr, excludeStr) {
    const parse = (s) =>
        typeof s === "string" ? s.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) : [];
    const include = parse(includeStr);
    const exclude = parse(excludeStr);
    const effectiveInclude = include.length > 0 ? include.filter((c) => !exclude.includes(c)) : [];
    return { include, exclude, effectiveInclude };
}

function getActionValue(actions, actionType) {
    if (!actions) return 0;
    const action = actions.find((a) => a.action_type === actionType);
    return parseFloat(action?.value || 0);
}

function purchaseConversionsFromActions(actions) {
    if (!actions) return 0;
    return (
        getActionValue(actions, "purchase") ||
        getActionValue(actions, "omni_purchase") ||
        getActionValue(actions, "offsite_conversion.fb_pixel_purchase")
    );
}

function purchaseValueFromActionValues(actionValues) {
    if (!actionValues) return 0;
    return (
        getActionValue(actionValues, "purchase") ||
        getActionValue(actionValues, "omni_purchase") ||
        getActionValue(actionValues, "offsite_conversion.fb_pixel_purchase")
    );
}

/**
 * Merge country breakdown rows into one row per date_start (monthly).
 */
function mergeMonthlyCountryRows(rows, exclude) {
    const filtered = rows.filter((row) => {
        const c = (row.country || "").toUpperCase();
        return c && !exclude.includes(c);
    });
    const byDate = {};
    for (const row of filtered) {
        const key = row.date_start || "";
        if (!byDate[key]) {
            byDate[key] = {
                date_start: key,
                spend: 0,
                impressions: 0,
                clicks: 0,
                freqWeighted: 0,
                actions: [],
                action_values: [],
            };
        }
        const impr = parseFloat(row.impressions || 0);
        byDate[key].spend += parseFloat(row.spend || 0);
        byDate[key].impressions += impr;
        byDate[key].clicks += parseFloat(row.clicks || 0);
        const f = parseFloat(row.frequency || 0);
        if (f > 0 && impr > 0) byDate[key].freqWeighted += f * impr;
        if (row.actions) byDate[key].actions.push(...row.actions);
        if (row.action_values) byDate[key].action_values.push(...row.action_values);
    }
    return Object.values(byDate)
        .map((r) => {
            const merge = (arr) => {
                const m = {};
                for (const a of arr || []) {
                    m[a.action_type] = (m[a.action_type] || 0) + parseFloat(a.value || 0);
                }
                return Object.entries(m).map(([action_type, v]) => ({ action_type, value: String(v) }));
            };
            const actions = merge(r.actions);
            const action_values = merge(r.action_values);
            const impressions = r.impressions;
            const clicks = r.clicks;
            const spend = r.spend;
            const freq = impressions > 0 && r.freqWeighted > 0 ? r.freqWeighted / impressions : null;
            return {
                date_start: r.date_start,
                spend,
                impressions,
                clicks,
                frequency: freq,
                ctr: impressions > 0 ? clicks / impressions : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                actions,
                action_values,
            };
        })
        .sort((a, b) => (a.date_start || "").localeCompare(b.date_start || ""));
}

function mergeActionArrays(arr) {
    const m = {};
    for (const a of arr || []) {
        m[a.action_type] = (m[a.action_type] || 0) + parseFloat(a.value || 0);
    }
    return Object.entries(m).map(([action_type, v]) => ({ action_type, value: String(v) }));
}

/** Sum country breakdown rows into one account-level row (for range aggregate). */
function mergeAggregateCountryRows(rows, exclude) {
    const filtered = rows.filter((row) => {
        const c = (row.country || "").trim().toUpperCase();
        if (!c) return true;
        return !exclude.includes(c);
    });
    if (!filtered.length) return null;
    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let freqWeighted = 0;
    const actions = [];
    const actionValues = [];
    for (const row of filtered) {
        spend += parseFloat(row.spend || 0);
        const impr = parseFloat(row.impressions || 0);
        impressions += impr;
        clicks += parseFloat(row.clicks || 0);
        const f = parseFloat(row.frequency || 0);
        if (f > 0 && impr > 0) freqWeighted += f * impr;
        if (row.actions) actions.push(...row.actions);
        if (row.action_values) actionValues.push(...row.action_values);
    }
    return {
        impressions,
        clicks,
        spend,
        frequency: impressions > 0 && freqWeighted > 0 ? freqWeighted / impressions : null,
        actions: mergeActionArrays(actions),
        action_values: mergeActionArrays(actionValues),
    };
}

function mapInsightRowToPiMetrics(row) {
    if (!row) return null;
    const impr = parseFloat(row.impressions || 0);
    const clicks = parseFloat(row.clicks || 0);
    const spend = parseFloat(row.spend || 0);
    const conv = purchaseConversionsFromActions(row.actions || []);
    const convValue = purchaseValueFromActionValues(row.action_values || []);
    const ctr = impr > 0 ? clicks / impr : null;
    const freq = row.frequency != null ? parseFloat(row.frequency) : null;
    const avgCpc = clicks > 0 ? spend / clicks : null;
    const convRate = clicks > 0 ? conv / clicks : null;
    const aov = conv > 0 ? convValue / conv : null;
    const roas = spend > 0 ? convValue / spend : null;
    const cpa = conv > 0 ? spend / conv : null;
    return {
        impr,
        clicks,
        ctr,
        freq,
        avgCpc,
        cost: spend,
        conv,
        convValue,
        convRate,
        aov,
        roas,
        cpa,
    };
}

function buildMonthlyInsightsUrl(adAccountId, since, until, metaIdInclude, metaIdExclude) {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const fields = [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "frequency",
        "actions",
        "action_values",
    ].join(",");

    const params = new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since, until }),
        time_increment: "monthly",
        level: "account",
        limit: "100",
    });

    const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
    if (effectiveInclude.length > 0) {
        params.append("filtering", JSON.stringify([{ field: "country", operator: "IN", value: effectiveInclude }]));
    }
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
    if (useBreakdown) {
        params.append("breakdowns", JSON.stringify(["country"]));
    }

    return `${accountId}/insights?${params.toString()}`;
}

function buildRangeAggregateUrl(adAccountId, since, until, metaIdInclude, metaIdExclude) {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const fields = [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "frequency",
        "actions",
        "action_values",
    ].join(",");

    const params = new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since, until }),
        level: "account",
        limit: "100",
    });

    const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
    if (effectiveInclude.length > 0) {
        params.append("filtering", JSON.stringify([{ field: "country", operator: "IN", value: effectiveInclude }]));
    }
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
    if (useBreakdown) {
        params.append("breakdowns", JSON.stringify(["country"]));
    }

    return `${accountId}/insights?${params.toString()}`;
}

async function fetchInsightsUrlPaginated(accessToken, relativePathAndQuery) {
    const sep = relativePathAndQuery.includes("?") ? "&" : "?";
    let url = `https://graph.facebook.com/${GRAPH_VERSION}/${relativePathAndQuery}${sep}access_token=${encodeURIComponent(accessToken)}`;
    const all = [];
    while (url) {
        const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`Facebook insights: invalid JSON ${text.slice(0, 200)}`);
        }
        if (data.error) {
            throw new Error(`Facebook insights: ${JSON.stringify(data.error)}`);
        }
        all.push(...(data.data || []));
        url = data.paging?.next || null;
    }
    return all;
}

async function fetchMonthlyInsightsNormalized(
    accessToken,
    adAccountId,
    since,
    until,
    metaIdInclude,
    metaIdExclude
) {
    const rel = buildMonthlyInsightsUrl(adAccountId, since, until, metaIdInclude, metaIdExclude);
    const { exclude, effectiveInclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
    let rows = await fetchInsightsUrlPaginated(accessToken, rel);
    if (useBreakdown && rows.length > 0) {
        rows = mergeMonthlyCountryRows(rows, exclude);
    } else {
        rows = (rows || []).map((row) => ({
            date_start: row.date_start,
            spend: parseFloat(row.spend || 0),
            impressions: parseFloat(row.impressions || 0),
            clicks: parseFloat(row.clicks || 0),
            frequency: row.frequency != null ? parseFloat(row.frequency) : null,
            actions: row.actions || [],
            action_values: row.action_values || [],
        }));
    }
    return rows;
}

/**
 * @returns {Map<string, object>} key `YYYY-MM` -> PI metric fields (no label)
 */
export async function fetchFacebookPiMonthlyByMonthKey({
    accessToken,
    adAccountId,
    since,
    until,
    metaIdInclude,
    metaIdExclude,
}) {
    const rows = await fetchMonthlyInsightsNormalized(
        accessToken,
        adAccountId,
        since,
        until,
        metaIdInclude,
        metaIdExclude
    );
    const map = new Map();
    for (const row of rows) {
        const key = (row.date_start || "").slice(0, 7);
        if (!key || key.length < 7) continue;
        const m = mapInsightRowToPiMetrics(row);
        if (m) map.set(key, m);
    }
    return map;
}

/**
 * @param {number} year
 * @param {string[]} monthLabels —12 labels e.g. PI_MONTH_LABELS
 * @param {Map<string, object>} byMonthKey
 * @param {Date} [now]
 */
export function buildPiMonthRowsForYear(year, monthLabels, byMonthKey, now = new Date()) {
    const yNow = now.getUTCFullYear();
    const mNow = now.getUTCMonth();
    const rows = [];
    for (let m = 0; m < 12; m++) {
        const mm = String(m + 1).padStart(2, "0");
        const key = `${year}-${mm}`;
        const label = monthLabels[m];
        const isFuture = year > yNow || (year === yNow && m > mNow);
        const data = byMonthKey.get(key);
        if (isFuture) {
            rows.push({
                label,
                impr: null,
                clicks: null,
                ctr: null,
                freq: null,
                avgCpc: null,
                cost: null,
                conv: null,
                convValue: null,
                convRate: null,
                aov: null,
                roas: null,
                cpa: null,
            });
        } else if (!data) {
            rows.push({
                label,
                impr: null,
                clicks: null,
                ctr: null,
                freq: null,
                avgCpc: null,
                cost: null,
                conv: null,
                convValue: null,
                convRate: null,
                aov: null,
                roas: null,
                cpa: null,
            });
        } else {
            rows.push({ label, ...data });
        }
    }
    return rows;
}

export async function fetchFacebookPiRangeAggregate({
    accessToken,
    adAccountId,
    since,
    until,
    metaIdInclude,
    metaIdExclude,
}) {
    const rel = buildRangeAggregateUrl(adAccountId, since, until, metaIdInclude, metaIdExclude);
    const { exclude, effectiveInclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
    let rows = await fetchInsightsUrlPaginated(accessToken, rel);
    if (!rows.length) return null;

    if (useBreakdown) {
        const one = mergeAggregateCountryRows(rows, exclude);
        return one ? mapInsightRowToPiMetrics(one) : null;
    }

    if (rows.length === 1) {
        const row = rows[0];
        const one = {
            impressions: parseFloat(row.impressions || 0),
            clicks: parseFloat(row.clicks || 0),
            spend: parseFloat(row.spend || 0),
            frequency: row.frequency != null ? parseFloat(row.frequency) : null,
            actions: row.actions || [],
            action_values: row.action_values || [],
        };
        return mapInsightRowToPiMetrics(one);
    }

    const one = mergeAggregateCountryRows(rows, []);
    return one ? mapInsightRowToPiMetrics(one) : null;
}

function addDaysIso(iso, delta) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + delta);
    return dt.toISOString().slice(0, 10);
}

function daysInclusive(start, end) {
    const a = new Date(`${start}T12:00:00.000Z`).getTime();
    const b = new Date(`${end}T12:00:00.000Z`).getTime();
    return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

/**
 * Prior period of same length ending the day before `startDate`.
 */
export function priorPeriodRange(startDate, endDate) {
    const n = daysInclusive(startDate, endDate);
    const prevEnd = addDaysIso(startDate, -1);
    const prevStart = addDaysIso(prevEnd, -(n - 1));
    return { prevStart, prevEnd };
}

const intFmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const dec1 = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});
const pctFmt = new Intl.NumberFormat("da-DK", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function pctChange(curr, prev) {
    if (curr == null || prev == null || prev === 0 || Number.isNaN(curr) || Number.isNaN(prev)) {
        return null;
    }
    return ((curr - prev) / Math.abs(prev)) * 100;
}

/**
 * Build funnel card payload for PerformanceInvestigatorFunnel (da-DK display strings).
 */
export function buildPiFunnelFromAggregates(current, previous) {
    const z = (v) => (v == null || Number.isNaN(v) ? 0 : v);
    const c = current || {};
    const p = previous || {};

    const ctrC = z(c.ctr);
    const ctrP = z(p.ctr);
    const crC = z(c.convRate);
    const crP = z(p.convRate);

    return {
        convValue: {
            label: "Conv. value",
            value: intFmt.format(z(c.convValue)),
            changePct: pctChange(c.convValue, p.convValue),
        },
        conversions: {
            label: "Conversions",
            value: intFmt.format(z(c.conv)),
            changePct: pctChange(c.conv, p.conv),
        },
        aov: {
            label: "AOV",
            value: dec2.format(z(c.aov)),
            changePct: pctChange(c.aov, p.aov),
        },
        convRate: {
            label: "Conv. Rate",
            value: pctFmt.format(crC),
            changePct: pctChange(crC, crP),
        },
        clicks: {
            label: "Clicks",
            value: intFmt.format(z(c.clicks)),
            changePct: pctChange(c.clicks, p.clicks),
        },
        ctr: {
            label: "CTR",
            value: pctFmt.format(ctrC),
            changePct: pctChange(ctrC, ctrP),
        },
        cpc: {
            label: "CpC",
            value: dec2.format(z(c.avgCpc)),
            changePct: pctChange(c.avgCpc, p.avgCpc),
        },
        impr: {
            label: "Impr.",
            value: intFmt.format(z(c.impr)),
            changePct: pctChange(c.impr, p.impr),
        },
        cost: {
            label: "Cost",
            value: intFmt.format(z(c.cost)),
            changePct: pctChange(c.cost, p.cost),
        },
        freq: {
            label: "Freq",
            value: dec2.format(z(c.freq)),
            changePct: pctChange(c.freq, p.freq),
        },
    };
}
