/**
 * Apex Radar — Facebook overview: account-level daily insights, batched Graph calls,
 * rolled up into 2d / 7d / 30d windows clipped to the UI date range.
 *
 * Meta does not expose a single “all ad accounts” insights call; use Batch API (max 50
 * sub-requests per HTTP request) or parallel GETs with a small concurrency limit.
 */

import {
    buildFacebookOverviewApexOnlySlice,
    buildOverviewTargetsBudgetAlerts,
    displayValueMetricFromRollup,
    getFacebookApexRadarSettings,
} from "@/lib/apexRadarCustomerSettings";

const GRAPH_VERSION = "v21.0";
const BATCH_SIZE = 50;
const PARALLEL_FALLBACK = 8;

function parseMetaIdFilter(includeStr, excludeStr) {
    const parse = (s) =>
        typeof s === "string" ? s.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) : [];
    const include = parse(includeStr);
    const exclude = parse(excludeStr);
    const effectiveInclude = include.length > 0 ? include.filter((c) => !exclude.includes(c)) : [];
    return { include, exclude, effectiveInclude };
}

/** @param {string} iso YYYY-MM-DD */
export function addDaysIso(iso, deltaDays) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return dt.toISOString().slice(0, 10);
}

/** @returns {string} later of a, b */
export function maxIso(a, b) {
    return a >= b ? a : b;
}

/** @returns {string} earlier of a, b */
export function minIso(a, b) {
    return a <= b ? a : b;
}

function getActionValue(actions, actionType) {
    if (!actions) return 0;
    const action = actions.find((a) => a.action_type === actionType);
    return parseFloat(action?.value || 0);
}

function purchaseConversionsFromActions(actions) {
    if (!actions) return 0;
    // Same priority as PS ad performance: first non-zero among Meta purchase action types.
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
 * Build account insights query (path + query only) for batch `relative_url`.
 */
export function buildAccountInsightsRelativeUrl(adAccountId, since, until, metaIdInclude, metaIdExclude) {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const fields = [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "frequency",
        "actions",
        "action_values",
    ].join(",");

    const params = new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since, until }),
        time_increment: "1",
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

/**
 * Same as daily insights but `time_increment=7` (~53 rows for a year — fits one Graph page; use for min-expected floors only).
 * Batch API returns only the first page of insights; never use this for 300+ daily rows.
 */
export function buildAccountInsightsWeeklyRelativeUrl(adAccountId, since, until, metaIdInclude, metaIdExclude) {
    const accountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    const fields = [
        "spend",
        "impressions",
        "clicks",
        "ctr",
        "frequency",
        "actions",
        "action_values",
    ].join(",");

    const params = new URLSearchParams({
        fields,
        time_range: JSON.stringify({ since, until }),
        time_increment: "7",
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

/**
 * Normalize Graph insights `data` rows to one row per date_start (merges country breakdown).
 */
export function normalizeDailyInsightRows(rawRows, { useBreakdown, exclude }) {
    let rows = rawRows || [];
    if (useBreakdown && rows.length > 0) {
        rows = rows.filter((row) => {
            const c = (row.country || "").toUpperCase();
            return c && !exclude.includes(c);
        });
        const byDate = {};
        for (const row of rows) {
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
        rows = Object.values(byDate)
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
                const freq = impressions > 0 && r.freqWeighted > 0 ? r.freqWeighted / impressions : null;
                return {
                    date_start: r.date_start,
                    spend: r.spend,
                    impressions,
                    clicks,
                    frequency: freq,
                    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
                    actions,
                    action_values,
                };
            })
            .sort((a, b) => (a.date_start || "").localeCompare(b.date_start || ""));
    } else if (rows.length > 0) {
        rows = rows.map((row) => {
            const impressions = parseFloat(row.impressions || 0);
            const clicks = parseFloat(row.clicks || 0);
            const freq = row.frequency != null ? parseFloat(row.frequency) : null;
            return {
                date_start: row.date_start,
                spend: parseFloat(row.spend || 0),
                impressions,
                clicks,
                frequency: Number.isFinite(freq) ? freq : null,
                ctr: impressions > 0 ? (clicks / impressions) * 100 : parseFloat(row.ctr || 0) || null,
                actions: row.actions || [],
                action_values: row.action_values || [],
            };
        });
    }
    return rows;
}

export function rollupDaily(dailyRows, fromDate, toDate) {
    const days = dailyRows.filter((d) => d.date_start >= fromDate && d.date_start <= toDate);
    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let value = 0;
    let freqWeighted = 0;

    for (const d of days) {
        spend += parseFloat(d.spend || 0);
        impressions += parseFloat(d.impressions || 0);
        clicks += parseFloat(d.clicks || 0);
        conversions += purchaseConversionsFromActions(d.actions);
        value += purchaseValueFromActionValues(d.action_values);
        const f = parseFloat(d.frequency || 0);
        const impr = parseFloat(d.impressions || 0);
        if (f > 0 && impr > 0) freqWeighted += f * impr;
    }

    const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : null;
    const freq = impressions > 0 && freqWeighted > 0 ? freqWeighted / impressions : null;
    const roas = spend > 0 ? value / spend : null;

    return { spend, impressions, clicks, conversions, value, ctrPct, freq, roas, daysUsed: days.length };
}

function monthStartIso(endIso) {
    const [y, m] = endIso.split("-").map(Number);
    if (!y || !m) return endIso;
    return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Monday UTC of the ISO week containing `dateIso` (YYYY-MM-DD). */
function weekMondayIsoUtc(dateIso) {
    const [y, mo, d] = dateIso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    const dow = dt.getUTCDay();
    const mondayOffset = (dow + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - mondayOffset);
    return dt.toISOString().slice(0, 10);
}

function sampleStdDev(values) {
    const n = values.length;
    if (n < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    let s = 0;
    for (const x of values) s += (x - mean) ** 2;
    return Math.sqrt(s / (n - 1));
}

/**
 * Weekly sums of conversion value (ROAS) or conversions (CPA); log10 per week; lower bounds
 * min7d = 10^(mean − 2·std), min30d = 10^(mean − std).
 * @param {Array<object>} dailyRows — normalized insight rows with date_start, actions, action_values
 * @param {"ROAS"|"CPA"} targetMetricType
 */
export function computeLog10WeeklyFloors(dailyRows, targetMetricType) {
    const byWeek = new Map();
    for (const row of dailyRows || []) {
        const conv = purchaseConversionsFromActions(row.actions);
        const val = purchaseValueFromActionValues(row.action_values);
        const add = targetMetricType === "CPA" ? conv : val;
        if (!Number.isFinite(add)) continue;
        const ds = row.date_start;
        if (!ds) continue;
        const wk = weekMondayIsoUtc(ds);
        byWeek.set(wk, (byWeek.get(wk) || 0) + add);
    }
    const totals = [...byWeek.values()].filter((t) => t > 0);
    const logs = totals.map((t) => Math.log10(t)).filter((x) => Number.isFinite(x));
    if (!logs.length) {
        return { minExpected7d: null, minExpected30d: null };
    }
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    const std = sampleStdDev(logs);
    return {
        minExpected7d: Math.pow(10, mean - 2 * std),
        minExpected30d: Math.pow(10, mean - std),
    };
}

/**
 * Min-expected floors from API rows that are already one aggregate per period (e.g. time_increment=7).
 * Each row must have merged `actions` / `action_values` like normalized daily rows.
 */
export function computeLog10FloorsFromPeriodRows(periodRows, targetMetricType) {
    const totals = [];
    for (const row of periodRows || []) {
        const conv = purchaseConversionsFromActions(row.actions);
        const val = purchaseValueFromActionValues(row.action_values);
        const v = targetMetricType === "CPA" ? conv : val;
        if (Number.isFinite(v) && v > 0) totals.push(v);
    }
    const logs = totals.map((t) => Math.log10(t)).filter((x) => Number.isFinite(x));
    if (!logs.length) {
        return { minExpected7d: null, minExpected30d: null };
    }
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    const std = sampleStdDev(logs);
    return {
        minExpected7d: Math.pow(10, mean - 2 * std),
        minExpected30d: Math.pow(10, mean - std),
    };
}

/**
 * @param {object} customer — Mongo customer doc (plain)
 * @param {string} startDate
 * @param {string} endDate
 * @param {object} roll — { r2, r7, r30, rMonthToDate, spendOnEndDate, minExpected7d, minExpected30d, … }
 * @param {object} [overviewOpts]
 * @param {(c: object) => object} [overviewOpts.getApexSettings]
 * @param {string} [overviewOpts.channel]
 * @param {object} [overviewOpts.defaultCustomerSettings] — default shape when customer has no `customerApexRadarSettings`
 */
export function buildOverviewRowFromRollups(customer, startDate, endDate, roll, overviewOpts = {}) {
    const getApex = overviewOpts.getApexSettings ?? getFacebookApexRadarSettings;
    const channelSlug = overviewOpts.channel ?? "facebook";
    const defaultSettings = overviewOpts.defaultCustomerSettings ?? { facebook: {} };
    const id = String(customer._id);
    const {
        r2,
        r7,
        r30,
        rMonthToDate,
        spendOnEndDate,
        minExpected7d,
        minExpected30d,
    } = roll;
    const apex = getApex(customer);
    const display7 = displayValueMetricFromRollup(r7, apex.targetMetricType);
    const display30 = displayValueMetricFromRollup(r30, apex.targetMetricType);
    const tbb = buildOverviewTargetsBudgetAlerts(apex, r7, r30, {
        spendOnAsOfDate: spendOnEndDate,
        realizedBudgetMonthToDate: rMonthToDate?.spend != null ? rMonthToDate.spend : null,
        asOfDate: endDate,
        displayValue7d: display7,
        displayValue30d: display30,
        minExpected7d,
        minExpected30d,
    });

    return {
        id,
        customerId: id,
        entity: customer.customerName || "Unnamed customer",
        value: {
            conversions2d: r2.conversions || null,
            value7d: display7,
            minExpectedValue7d: minExpected7d,
            value30d: display30,
            minExpectedValue30d: minExpected30d,
        },
        targets: tbb.targets,
        budget: tbb.budget,
        ads: {
            adFatigue: null,
            ctr7d: r7.ctrPct,
            ctr30d: r30.ctrPct,
            freq7d: r7.freq,
            freq30d: r30.freq,
        },
        alerts: tbb.alerts,
        customerApexRadarSettings: customer.customerApexRadarSettings || defaultSettings,
        apexRadarMeta: {
            channel: channelSlug,
            windows: { startDate, endDate, win2: roll.win2, win7: roll.win7, win30: roll.win30 },
        },
    };
}

/**
 * Compute metric windows and daily fetch range (small — fits one Graph “page” so Batch API isn’t truncated).
 * Long history for min-expected floors uses a separate weekly insights call (`weeklyFloorsSince`).
 */
export function computeDateWindows(startDate, endDate) {
    const win2Start = maxIso(startDate, addDaysIso(endDate, -1));
    const win7Start = maxIso(startDate, addDaysIso(endDate, -6));
    const win30Start = maxIso(startDate, addDaysIso(endDate, -29));
    const monthStart = monthStartIso(endDate);
    const fetchSince = minIso(win30Start, monthStart);
    const fetchUntil = endDate;
    const weeklyFloorsSince = addDaysIso(endDate, -371);
    return {
        fetchSince,
        fetchUntil,
        weeklyFloorsSince,
        win2: { from: win2Start, to: endDate },
        win7: { from: win7Start, to: endDate },
        win30: { from: win30Start, to: endDate },
        monthStart,
    };
}

/** UTC calendar “today” and the two preceding days (insights date_start alignment). */
export function getUtcCalendarSpendDodRange() {
    const utcToday = new Date().toISOString().slice(0, 10);
    return {
        utcToday,
        calendarYesterday: addDaysIso(utcToday, -1),
        calendarDayBeforeYesterday: addDaysIso(utcToday, -2),
    };
}

/** Day-over-day spend warning: alert when pctChangeFromPrior ≤ this value (default −90 = at least ~90% drop vs prior). */
export const APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD = -90;

/**
 * Row meets the DoD threshold when % change from prior UTC day to yesterday is at or below threshold (e.g. −90%).
 */
export function meetsSpendDodThreshold(row, thresholdPct = APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD) {
    const p = row?.spendDayOverDay?.pctChangeFromPrior;
    if (p == null || !Number.isFinite(p)) return false;
    return p <= thresholdPct;
}

/**
 * Consecutive UTC calendar days ending at `calendarYesterday` with zero conversions.
 * Only counts days present in `dailyRows`; breaks on the first day with conversions.
 * `hadSpendInStreak` is true when at least one day in the streak had spend > 0.
 */
export function computeConversionTrackingFromDaily(dailyRows, maxLookback = 14) {
    const { calendarYesterday } = getUtcCalendarSpendDodRange();
    const byDate = new Map();
    for (const d of dailyRows || []) {
        if (d.date_start) byDate.set(d.date_start, d);
    }

    let streak = 0;
    let streakStartDate = null;
    let hadSpendInStreak = false;

    for (let i = 0; i < maxLookback; i++) {
        const date = addDaysIso(calendarYesterday, -i);
        const row = byDate.get(date);
        if (!row) break;

        const conv = purchaseConversionsFromActions(row.actions);
        if (conv > 0) break;

        const spend = parseFloat(row.spend || 0);
        if (spend > 0) hadSpendInStreak = true;
        streak++;
        streakStartDate = date;
    }

    return {
        asOfDate: calendarYesterday,
        consecutiveZeroConversionDays: streak,
        streakStartDate,
        streakEndDate: streak > 0 ? calendarYesterday : null,
        hadSpendInStreak,
    };
}

/** Default: alert when this many consecutive UTC days (ending yesterday) have zero conversions. */
export const APEX_RADAR_CONVERSION_ZERO_DAYS_THRESHOLD = 2;

/**
 * Prior-day spend alert: meaningful spend on day-before-yesterday, zero spend yesterday (UTC).
 */
export function meetsPriorDaySpendStoppedAlert(row, minPriorSpend = 1) {
    const dod = row?.spendDayOverDay || {};
    const prior = dod.spendDayBeforeYesterday;
    const yest = dod.spendYesterday;
    if (prior == null || prior < minPriorSpend) return false;
    return yest == null || yest <= 0;
}

export function computeSpendDayOverDayFromDaily(dailyRows) {
    const { calendarYesterday: y, calendarDayBeforeYesterday: d2 } = getUtcCalendarSpendDodRange();
    const rowY = (dailyRows || []).find((d) => d.date_start === y);
    const rowD2 = (dailyRows || []).find((d) => d.date_start === d2);
    const spendYesterday = rowY != null ? parseFloat(rowY.spend || 0) : null;
    const spendDayBeforeYesterday = rowD2 != null ? parseFloat(rowD2.spend || 0) : null;

    let pctChangeFromPrior = null;
    if (
        spendDayBeforeYesterday != null &&
        spendDayBeforeYesterday > 0 &&
        spendYesterday != null
    ) {
        pctChangeFromPrior =
            ((spendYesterday - spendDayBeforeYesterday) / spendDayBeforeYesterday) * 100;
    }

    const warnDrop =
        pctChangeFromPrior != null && pctChangeFromPrior <= APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD;

    return {
        calendarYesterday: y,
        calendarDayBeforeYesterday: d2,
        spendYesterday,
        spendDayBeforeYesterday,
        pctChangeFromPrior,
        warnDrop,
    };
}

async function postFacebookBatch(accessToken, batchItems) {
    const form = new URLSearchParams();
    form.set("access_token", accessToken);
    form.set("batch", JSON.stringify(batchItems));
    form.set("include_headers", "false");
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`Facebook batch: invalid JSON (${res.status}) ${text.slice(0, 200)}`);
    }
    if (json.error) {
        throw new Error(`Facebook batch: ${JSON.stringify(json.error)}`);
    }
    return json;
}

async function fetchAccountInsightsDailyPaginated(accessToken, relativePathAndQuery) {
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
            throw new Error(`Facebook insights: bad JSON ${text.slice(0, 200)}`);
        }
        if (data.error) {
            throw new Error(`Facebook insights: ${JSON.stringify(data.error)}`);
        }
        all.push(...(data.data || []));
        url = data.paging?.next || null;
    }
    return all;
}

function parseBatchBody(batchEntry) {
    if (!batchEntry) return { ok: false, error: "empty batch entry" };
    const code = batchEntry.code;
    let body;
    try {
        body = typeof batchEntry.body === "string" ? JSON.parse(batchEntry.body) : batchEntry.body;
    } catch {
        return { ok: false, error: `batch parse ${batchEntry.body?.slice?.(0, 120)}` };
    }
    if (code !== 200 || body.error) {
        return { ok: false, error: body.error ? JSON.stringify(body.error) : `HTTP ${code}` };
    }
    return { ok: true, body };
}

async function poolMap(items, concurrency, mapper) {
    const results = new Array(items.length);
    let idx = 0;
    async function worker() {
        for (;;) {
            const i = idx++;
            if (i >= items.length) break;
            results[i] = await mapper(items[i], i);
        }
    }
    const n = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: n }, worker));
    return results;
}

/**
 * @param {string} accessToken
 * @param {Array<{ customer: object, relativeUrl: string, meta: object }>} jobs — meta: { effectiveInclude, exclude, useBreakdown }
 * @returns {Promise<Array<{ customer: object, daily: object[], error?: string }>>}
 */
async function runInsightsJobs(accessToken, jobs) {
    if (!jobs.length) return [];

    const batchChunks = [];
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        batchChunks.push(jobs.slice(i, i + BATCH_SIZE));
    }

    const out = [];

    for (const chunk of batchChunks) {
        try {
            const batchPayload = chunk.map((j) => ({
                method: "GET",
                relative_url: j.relativeUrl,
            }));
            const batchRes = await postFacebookBatch(accessToken, batchPayload);
            if (!Array.isArray(batchRes)) {
                throw new Error("batch response not array");
            }
            for (let i = 0; i < chunk.length; i++) {
                const parsed = parseBatchBody(batchRes[i]);
                const { customer, meta } = chunk[i];
                if (!parsed.ok) {
                    out.push({ customer, daily: [], error: parsed.error });
                    continue;
                }
                const rawRows = parsed.body.data || [];
                const daily = normalizeDailyInsightRows(rawRows, meta);
                out.push({ customer, daily, error: null });
            }
        } catch (e) {
            const fallback = await poolMap(chunk, PARALLEL_FALLBACK, async (job) => {
                try {
                    const rawRows = await fetchAccountInsightsDailyPaginated(accessToken, job.relativeUrl);
                    const daily = normalizeDailyInsightRows(rawRows, job.meta);
                    return { customer: job.customer, daily, error: null };
                } catch (err) {
                    return {
                        customer: job.customer,
                        daily: [],
                        error: err.message || String(err),
                    };
                }
            });
            out.push(...fallback);
        }
    }

    return out;
}

const DEFAULT_FB_ROLL_OPTS = {
    getApexSettings: getFacebookApexRadarSettings,
    channel: "facebook",
    defaultCustomerSettings: { facebook: {} },
};

/**
 * @param {object} [overviewOpts] — passed to {@link buildOverviewRowFromRollups} (defaults: Facebook)
 */
export function rollOverviewWindows(
    customer,
    startDate,
    endDate,
    daily,
    weeklyPeriodRows = null,
    overviewOpts = DEFAULT_FB_ROLL_OPTS
) {
    const getApex = overviewOpts.getApexSettings ?? getFacebookApexRadarSettings;
    const w = computeDateWindows(startDate, endDate);
    const dodRef = getUtcCalendarSpendDodRange();
    const effFetchUntil = maxIso(w.fetchUntil, dodRef.calendarYesterday);
    const effFetchSince = minIso(w.fetchSince, dodRef.calendarDayBeforeYesterday);
    const r2 = rollupDaily(daily, w.win2.from, w.win2.to);
    const r7 = rollupDaily(daily, w.win7.from, w.win7.to);
    const r30 = rollupDaily(daily, w.win30.from, w.win30.to);

    const rMonthToDate = rollupDaily(daily, w.monthStart, endDate);

    const endRow = daily.find((d) => d.date_start === endDate);
    const spendOnEndDate =
        endRow != null
            ? parseFloat(endRow.spend || 0)
            : endDate <= effFetchUntil && endDate >= effFetchSince
              ? 0
              : null;

    const apex = getApex(customer);
    let minExpected7d;
    let minExpected30d;
    if (weeklyPeriodRows && weeklyPeriodRows.length > 0) {
        ({ minExpected7d, minExpected30d } = computeLog10FloorsFromPeriodRows(weeklyPeriodRows, apex.targetMetricType));
    } else {
        ({ minExpected7d, minExpected30d } = computeLog10WeeklyFloors(daily, apex.targetMetricType));
    }

    const row = buildOverviewRowFromRollups(
        customer,
        startDate,
        endDate,
        {
            r2,
            r7,
            r30,
            rMonthToDate,
            spendOnEndDate,
            minExpected7d,
            minExpected30d,
            win2: w.win2,
            win7: w.win7,
            win30: w.win30,
        },
        overviewOpts
    );
    const spendDayOverDay = computeSpendDayOverDayFromDaily(daily);
    const conversionTracking = computeConversionTrackingFromDaily(daily);
    return { ...row, spendDayOverDay, conversionTracking };
}

function rollCustomerWindows(customer, startDate, endDate, daily, weeklyPeriodRows = null) {
    return rollOverviewWindows(customer, startDate, endDate, daily, weeklyPeriodRows, DEFAULT_FB_ROLL_OPTS);
}

/**
 * Fetch overview rows for many customers (each must have CustomerSettings.facebookAdAccountId).
 * @param {object} opts
 * @param {string} opts.accessToken — Facebook app / system token
 * @param {string} opts.startDate — YYYY-MM-DD
 * @param {string} opts.endDate — YYYY-MM-DD
 * @param {object[]} opts.customers — plain customer docs
 * @param {(id: string) => boolean} [opts.isDemoCustomer] — skip Graph, use demo row
 * @param {(customer: object) => object} [opts.buildDemoRow] — (customer) => row metrics
 */
function placeholderRowNoAdAccount(customer, startDate, endDate) {
    const w = computeDateWindows(startDate, endDate);
    const dod = getUtcCalendarSpendDodRange();
    const id = String(customer._id);
    const apexSlice = buildFacebookOverviewApexOnlySlice(customer);
    return {
        id,
        customerId: id,
        entity: customer.customerName || "Unnamed customer",
        value: {
            conversions2d: null,
            value7d: null,
            minExpectedValue7d: null,
            value30d: null,
            minExpectedValue30d: null,
        },
        targets: apexSlice.targets,
        budget: apexSlice.budget,
        ads: {
            adFatigue: null,
            ctr7d: null,
            ctr30d: null,
            freq7d: null,
            freq30d: null,
        },
        alerts: apexSlice.alerts,
        customerApexRadarSettings: customer.customerApexRadarSettings || { facebook: {} },
        spendDayOverDay: {
            calendarYesterday: dod.calendarYesterday,
            calendarDayBeforeYesterday: dod.calendarDayBeforeYesterday,
            spendYesterday: null,
            spendDayBeforeYesterday: null,
            pctChangeFromPrior: null,
            warnDrop: false,
        },
        apexRadarMeta: {
            channel: "facebook",
            skipReason: "no_ad_account",
            windows: w,
        },
    };
}

export async function fetchApexRadarFacebookOverviewRows({
    accessToken,
    startDate,
    endDate,
    customers,
    isDemoCustomer = () => false,
    buildDemoRow = null,
}) {
    if (!accessToken) {
        throw new Error("Missing Facebook access token");
    }
    if (!startDate || !endDate || endDate < startDate) {
        throw new Error("Invalid date range");
    }

    const windows = computeDateWindows(startDate, endDate);
    const dod = getUtcCalendarSpendDodRange();
    const fetchUntilExtended = maxIso(windows.fetchUntil, dod.calendarYesterday);
    const fetchSinceExtended = minIso(windows.fetchSince, dod.calendarDayBeforeYesterday);

    const byCustomerId = new Map();
    const jobs = [];

    for (const customer of customers) {
        const id = String(customer._id);
        if (isDemoCustomer(id)) {
            if (buildDemoRow) {
                byCustomerId.set(id, buildDemoRow(customer, startDate, endDate));
            }
            continue;
        }
        const settings = customer.CustomerSettings || {};
        const adId = (settings.facebookAdAccountId || "").trim();
        if (!adId) {
            byCustomerId.set(id, placeholderRowNoAdAccount(customer, startDate, endDate));
            continue;
        }

        const metaIdInclude = settings.customerMetaID || "";
        const metaIdExclude = settings.customerMetaIDExclude || "";
        const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
        const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;

        const relativeUrl = buildAccountInsightsRelativeUrl(
            adId,
            fetchSinceExtended,
            fetchUntilExtended,
            metaIdInclude,
            metaIdExclude
        );

        const weeklyRelativeUrl = buildAccountInsightsWeeklyRelativeUrl(
            adId,
            windows.weeklyFloorsSince,
            fetchUntilExtended,
            metaIdInclude,
            metaIdExclude
        );

        jobs.push({
            customer,
            relativeUrl,
            weeklyRelativeUrl,
            meta: { effectiveInclude, exclude, useBreakdown },
        });
    }

    const dailyJobs = jobs.map(({ customer, relativeUrl, meta }) => ({ customer, relativeUrl, meta }));
    const weeklyJobs = jobs.map(({ customer, weeklyRelativeUrl, meta }) => ({
        customer,
        relativeUrl: weeklyRelativeUrl,
        meta,
    }));

    const [insightResults, weeklyInsightResults] = await Promise.all([
        runInsightsJobs(accessToken, dailyJobs),
        runInsightsJobs(accessToken, weeklyJobs),
    ]);

    const weeklyByCustomerId = new Map();
    for (const res of weeklyInsightResults) {
        const id = String(res.customer._id);
        weeklyByCustomerId.set(id, res.error ? null : res.daily);
    }

    for (let i = 0; i < insightResults.length; i++) {
        const res = insightResults[i];
        const id = String(res.customer._id);
        const weeklyRows = weeklyByCustomerId.get(id) || null;
        if (res.error) {
            const emptyRow = rollCustomerWindows(res.customer, startDate, endDate, [], weeklyRows);
            byCustomerId.set(id, {
                ...emptyRow,
                apexRadarMeta: {
                    ...emptyRow.apexRadarMeta,
                    facebookError: res.error,
                    windows,
                },
            });
        } else {
            byCustomerId.set(id, rollCustomerWindows(res.customer, startDate, endDate, res.daily, weeklyRows));
        }
    }

    const rows = customers
        .map((c) => byCustomerId.get(String(c._id)))
        .filter((r) => r != null);

    return { rows, windows };
}
