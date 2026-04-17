/**
 * Apex Radar — Facebook overview: account-level daily insights, batched Graph calls,
 * rolled up into 2d / 7d / 30d windows clipped to the UI date range.
 *
 * Meta does not expose a single “all ad accounts” insights call; use Batch API (max 50
 * sub-requests per HTTP request) or parallel GETs with a small concurrency limit.
 */

import {
    buildFacebookOverviewApexOnlySlice,
    buildFacebookOverviewTargetsBudgetAlerts,
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
function maxIso(a, b) {
    return a >= b ? a : b;
}

/** @returns {string} earlier of a, b */
function minIso(a, b) {
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

function rollupDaily(dailyRows, fromDate, toDate) {
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

/**
 * @param {object} customer — Mongo customer doc (plain)
 * @param {string} startDate
 * @param {string} endDate
 * @param {object} roll — { r2, r7, r30, yesterdaySpend }
 */
export function buildOverviewRowFromRollups(customer, startDate, endDate, roll) {
    const id = String(customer._id);
    const { r2, r7, r30, yesterdaySpend } = roll;
    const tbb = buildFacebookOverviewTargetsBudgetAlerts(customer, r7, r30, yesterdaySpend);

    return {
        id,
        customerId: id,
        entity: customer.customerName || "Unnamed customer",
        value: {
            conversions2d: r2.conversions || null,
            value7d: r7.value || null,
            minExpectedValue7d: null,
            value30d: r30.value || null,
            minExpectedValue30d: null,
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
        customerApexRadarSettings: customer.customerApexRadarSettings || { facebook: {} },
        apexRadarMeta: {
            channel: "facebook",
            windows: { startDate, endDate, win2: roll.win2, win7: roll.win7, win30: roll.win30 },
        },
    };
}

/**
 * Compute fetch window and metric windows clipped to [startDate, endDate].
 */
export function computeDateWindows(startDate, endDate) {
    const win2Start = maxIso(startDate, addDaysIso(endDate, -1));
    const win7Start = maxIso(startDate, addDaysIso(endDate, -6));
    const win30Start = maxIso(startDate, addDaysIso(endDate, -29));
    const fetchSince = win30Start;
    const fetchUntil = endDate;
    const yesterdayStr = addDaysIso(endDate, -1);
    const yesterdayInRange = yesterdayStr >= startDate && yesterdayStr <= endDate;
    return {
        fetchSince,
        fetchUntil,
        win2: { from: win2Start, to: endDate },
        win7: { from: win7Start, to: endDate },
        win30: { from: win30Start, to: endDate },
        yesterdayStr,
        yesterdayInRange,
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

function rollCustomerWindows(customer, startDate, endDate, daily) {
    const w = computeDateWindows(startDate, endDate);
    const r2 = rollupDaily(daily, w.win2.from, w.win2.to);
    const r7 = rollupDaily(daily, w.win7.from, w.win7.to);
    const r30 = rollupDaily(daily, w.win30.from, w.win30.to);

    let yesterdaySpend = null;
    if (w.yesterdayInRange) {
        const y = daily.find((d) => d.date_start === w.yesterdayStr);
        yesterdaySpend = y ? parseFloat(y.spend || 0) : 0;
    }

    const row = buildOverviewRowFromRollups(customer, startDate, endDate, {
        r2,
        r7,
        r30,
        yesterdaySpend,
        win2: w.win2,
        win7: w.win7,
        win30: w.win30,
    });
    return row;
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
            windows.fetchSince,
            windows.fetchUntil,
            metaIdInclude,
            metaIdExclude
        );

        jobs.push({
            customer,
            relativeUrl,
            meta: { effectiveInclude, exclude, useBreakdown },
        });
    }

    const insightResults = await runInsightsJobs(accessToken, jobs);

    for (const res of insightResults) {
        const id = String(res.customer._id);
        if (res.error) {
            const emptyRow = rollCustomerWindows(res.customer, startDate, endDate, []);
            byCustomerId.set(id, {
                ...emptyRow,
                apexRadarMeta: {
                    ...emptyRow.apexRadarMeta,
                    facebookError: res.error,
                    windows,
                },
            });
        } else {
            byCustomerId.set(id, rollCustomerWindows(res.customer, startDate, endDate, res.daily));
        }
    }

    const rows = customers
        .map((c) => byCustomerId.get(String(c._id)))
        .filter((r) => r != null);

    return { rows, windows };
}
