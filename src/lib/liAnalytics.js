/**
 * Derived insights for the LinkedIn Ads dashboard. Pure functions over the dashboard payload.
 * LinkedIn reports no revenue, so success is judged on leads (Lead Gen Forms) and web conversions.
 * Status is always against the account's own cost per result, never an outside benchmark.
 */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (rows, key) => (rows || []).reduce((s, r) => s + n(r[key]), 0);

export function summarizeLi(rows, reach) {
    if (!rows?.length) return null;
    const spend = sum(rows, "ad_spend");
    const impressions = sum(rows, "impressions");
    const clicks = sum(rows, "clicks");
    const leads = sum(rows, "leads");
    const formOpens = sum(rows, "lead_form_opens");
    const conversions = sum(rows, "conversions");
    const results = leads + conversions;
    return {
        spend,
        impressions,
        clicks,
        leads,
        formOpens,
        conversions,
        results,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        cpc: clicks > 0 ? spend / clicks : null,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        cpl: leads > 0 ? spend / leads : null,
        costPerConversion: conversions > 0 ? spend / conversions : null,
        costPerResult: results > 0 ? spend / results : null,
        formOpenRate: clicks > 0 && formOpens > 0 ? (formOpens / clicks) * 100 : null,
        formCompletion: formOpens > 0 ? (leads / formOpens) * 100 : null,
        reach: reach?.reach ?? null,
        frequency: reach?.frequency ?? null,
        engagementRate: reach && impressions > 0 ? (n(reach.total_engagements) / impressions) * 100 : null,
        hasLeads: leads > 0,
    };
}

/** Impressions to clicks to Lead Gen Form opens to leads, each with the share from the step before. */
export function liFunnel(summary) {
    if (!summary) return [];
    const steps = [{ id: "impressions", label: "Impressions", value: summary.impressions }, { id: "clicks", label: "Clicks", value: summary.clicks }];
    if (summary.formOpens > 0) steps.push({ id: "opens", label: "Form opens", value: summary.formOpens }, { id: "leads", label: "Leads", value: summary.leads });
    else if (summary.leads > 0) steps.push({ id: "leads", label: "Leads", value: summary.leads });
    if (summary.conversions > 0) steps.push({ id: "web", label: "Web conversions", value: summary.conversions, branch: true });
    return steps.map((s, i) => {
        const prev = s.branch ? steps[1] : steps[i - 1];
        return {
            ...s,
            ofImpressions: steps[0].value > 0 ? s.value / steps[0].value : null,
            fromPrev: i > 0 && prev && prev.value > 0 ? s.value / prev.value : null,
            fromLabel: i > 0 && prev ? prev.label : null,
        };
    });
}

/**
 * Status of a campaign or ad: cost per result against the account (results are leads plus web
 * conversions). Lower cost is better. Under 1% of spend is low volume; spend with no result is flagged.
 */
export function costStatus(row, accountCostPerResult, totalSpend) {
    const spend = n(row.ad_spend);
    const results = n(row.leads) + n(row.conversions);
    if (!accountCostPerResult || totalSpend <= 0 || spend / totalSpend < 0.01) return { id: "low", label: "Low volume", tone: "neutral" };
    if (results <= 0) return { id: "none", label: "No results", tone: "bad" };
    const ratio = accountCostPerResult / (spend / results);
    if (ratio >= 1.25) return { id: "strong", label: "Strong", tone: "ok" };
    if (ratio >= 0.85) return { id: "solid", label: "Solid", tone: "ok" };
    if (ratio >= 0.5) return { id: "soft", label: "Soft", tone: "warn" };
    return { id: "weak", label: "Weak", tone: "bad" };
}

/**
 * Audience rows with share of impressions against share of results (leads, or clicks when the account has
 * no leads) and a cost per result. An index above 1 means the group responds more than its share of reach.
 */
export function audienceRows(rows, { byLeads }) {
    const list = rows || [];
    const impressions = sum(list, "impressions");
    const metricKey = byLeads ? "leads" : "clicks";
    const metricTotal = sum(list, metricKey);
    return list.map((r) => {
        const impShare = impressions > 0 ? n(r.impressions) / impressions : 0;
        const resShare = metricTotal > 0 ? n(r[metricKey]) / metricTotal : 0;
        const index = impShare > 0.01 ? resShare / impShare : null;
        const results = n(r.leads) + n(r.conversions);
        let verdict = { label: "In line", tone: "neutral" };
        if (impShare < 0.03 || metricTotal <= 0) verdict = { label: "Low volume", tone: "neutral" };
        else if (index >= 1.3) verdict = { label: "Over-indexes", tone: "ok" };
        else if (index < 0.6) verdict = { label: "Under-indexes", tone: "bad" };
        else if (index < 0.85) verdict = { label: "Soft", tone: "warn" };
        return {
            ...r,
            impShare,
            resShare,
            index,
            verdict,
            costPerLead: n(r.leads) > 0 ? n(r.ad_spend) / n(r.leads) : null,
            costPerResult: results > 0 ? n(r.ad_spend) / results : null,
        };
    });
}

/** Average of a metric per weekday. Needs two weeks for a fair average. */
export function liWeekdays(rows, key) {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (!rows?.length || rows.length < 14) return { enough: false, days: [] };
    const buckets = labels.map((label) => ({ label, value: 0, spend: 0, count: 0 }));
    for (const r of rows) {
        const idx = (new Date(`${r.date}T12:00:00Z`).getUTCDay() + 6) % 7;
        buckets[idx].value += n(r[key]);
        buckets[idx].spend += n(r.ad_spend);
        buckets[idx].count += 1;
    }
    const days = buckets.map((b) => ({ label: b.label, avg: b.count ? b.value / b.count : 0, avgSpend: b.count ? b.spend / b.count : 0, cost: b.value > 0 ? b.spend / b.value : null }));
    const max = Math.max(...days.map((d) => d.avg), 1);
    const costed = days.filter((d) => d.cost != null);
    const bestCost = costed.length ? costed.reduce((a, b) => (b.cost < a.cost ? b : a)) : null;
    const best = days.reduce((a, b) => (b.avg > a.avg ? b : a), days[0]);
    return { enough: true, best, bestCost, days: days.map((d) => ({ ...d, index: d.avg / max, isBest: d.label === best.label })) };
}

/** Delivery per ad format: how each creative format spends and what it returns. */
export function formatSummary(ads) {
    const map = new Map();
    for (const a of ads || []) {
        const key = a.format || "Sponsored";
        const cur = map.get(key) || { format: key, ads: 0, ad_spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0 };
        cur.ads += 1;
        cur.ad_spend += n(a.ad_spend);
        cur.impressions += n(a.impressions);
        cur.clicks += n(a.clicks);
        cur.leads += n(a.leads);
        cur.conversions += n(a.conversions);
        map.set(key, cur);
    }
    const total = [...map.values()].reduce((s, f) => s + f.ad_spend, 0);
    return [...map.values()]
        .map((f) => ({
            ...f,
            spendShare: total > 0 ? f.ad_spend / total : 0,
            ctr: f.impressions > 0 ? f.clicks / f.impressions : 0,
            cpl: f.leads > 0 ? f.ad_spend / f.leads : null,
            cpc: f.clicks > 0 ? f.ad_spend / f.clicks : null,
        }))
        .sort((a, b) => b.ad_spend - a.ad_spend);
}
