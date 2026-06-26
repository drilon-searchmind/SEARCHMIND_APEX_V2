/**
 * SEO Organic Insights tab — volume potential, landing pages, keywords, cannibalization, brand split.
 */

import {
    buildVolumePotentialRows,
    buildDemoVolumePotentialRows,
    fetchAhrefsVolumeByKeyword,
    TOP3_ORGANIC_CTR,
} from "@/lib/seoVolumePotential";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { numHash } from "@/lib/demoAdMetrics";
import { computeBrandKeywordMetrics } from "@/lib/seoDashboardUtils";
import {
    filterGscQueryRows,
    filterAndAggregateGscPagesFromQueryPage,
    hasActiveKeywordGroupFilters,
    queryMatchesKeywordGroupFilters,
} from "@/lib/seoKeywordFilters";

export { TOP3_ORGANIC_CTR };

function normalizeKeyword(kw) {
    return String(kw || "").trim().toLowerCase();
}

function pathFromGscPage(page) {
    const raw = String(page || "");
    try {
        const u = raw.includes("://") ? new URL(raw) : new URL(`https://x${raw.startsWith("/") ? "" : "/"}${raw}`);
        return u.pathname || raw;
    } catch {
        return raw;
    }
}

export function isBrandQuery(query, brandTerms) {
    const q = normalizeKeyword(query);
    const terms = (brandTerms || []).map((t) => normalizeKeyword(t)).filter(Boolean);
    return terms.some((t) => q.includes(t));
}

export function percentChange(current, prev) {
    if (prev == null || prev === undefined || prev === 0) return null;
    if (current == null || current === undefined) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}

export function positionDelta(current, prev) {
    if (current == null || prev == null || !Number.isFinite(current) || !Number.isFinite(prev)) {
        return null;
    }
    return prev - current;
}

function mapGscQueryRows(rows) {
    const map = {};
    for (const r of rows || []) {
        const key = r.keys?.[0];
        if (!key) continue;
        map[normalizeKeyword(key)] = r;
    }
    return map;
}

function mapGscPageRows(rows) {
    const map = {};
    for (const r of rows || []) {
        const key = pathFromGscPage(r.keys?.[0]);
        if (!key) continue;
        map[key] = { ...r, path: key };
    }
    return map;
}

function economicsFromSupplemental(gscKeywordRows, supplemental) {
    const totalClicks = (gscKeywordRows || []).reduce((s, r) => s + (r.clicks || 0), 0);
    const organicRevenue = supplemental?.organic_revenue ?? null;
    return {
        avgCpc: supplemental?.avg_cpc ?? null,
        revenuePerClick:
            totalClicks > 0 && organicRevenue != null ? organicRevenue / totalClicks : null,
    };
}

function ctrAsPercent(row) {
    if (!row) return null;
    const imp = row.impressions || 0;
    const clicks = row.clicks || 0;
    if (imp > 0) return (clicks / imp) * 100;
    if (row.ctr == null) return null;
    return row.ctr <= 1 ? row.ctr * 100 : row.ctr;
}

/**
 * @param {object} cur
 * @param {object|null} prev
 */
function withYoY(cur, prev, fields) {
    const out = { ...cur };
    for (const f of fields) {
        const c = cur[f];
        let p = prev?.[f];
        if (f === "ctr") {
            const cCtr = typeof c === "number" ? c : ctrAsPercent(prev);
            const pCtr = ctrAsPercent(prev);
            out[`${f}_yoy_pp`] = cCtr != null && pCtr != null ? cCtr - pCtr : null;
            out[`${f}_yoy_pct`] = percentChange(cCtr, pCtr);
            continue;
        }
        if (f === "position") {
            out[`${f}_yoy`] = positionDelta(c, p);
            out[`${f}_yoy_pct`] = percentChange(c, p);
        } else {
            out[`${f}_yoy_pct`] = percentChange(c, p);
        }
    }
    return out;
}

export function buildKeywordOverviewRows(currentRows, prevRows, volumeByKeyword, economics) {
    const prevMap = mapGscQueryRows(prevRows);
    const rows = [];

    for (const row of currentRows || []) {
        const keyword = row.keys?.[0];
        if (!keyword) continue;
        const norm = normalizeKeyword(keyword);
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        let volume = volumeByKeyword[norm] ?? null;
        if (volume == null && impressions > 0) volume = Math.round(impressions * 4);

        const cur = {
            id: norm,
            keyword,
            volume,
            position: row.position != null ? Number(row.position) : null,
            clicks,
            ctr: ctrAsPercent(row),
            spend_saved: economics.avgCpc != null && clicks > 0 ? clicks * economics.avgCpc : null,
        };
        rows.push(withYoY(cur, prevMap[norm], ["volume", "position", "clicks", "ctr"]));
    }

    rows.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    return rows.slice(0, 100);
}

export function buildTopLandingPagesRows(currentRows, prevRows, economics) {
    const prevMap = mapGscPageRows(prevRows);
    const rows = [];

    for (const row of currentRows || []) {
        const path = pathFromGscPage(row.keys?.[0]);
        if (!path) continue;
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        const cur = {
            id: path,
            url: path,
            clicks,
            impressions,
            ctr: ctrAsPercent(row),
            position: row.position != null ? Number(row.position) : null,
            value: economics.revenuePerClick != null && clicks > 0 ? clicks * economics.revenuePerClick : null,
            spend_saved: economics.avgCpc != null && clicks > 0 ? clicks * economics.avgCpc : null,
        };
        const prev = prevMap[path];
        rows.push(withYoY(cur, prev, ["clicks", "impressions", "ctr", "position"]));
    }

    rows.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    return rows.slice(0, 50);
}

export function buildCannibalizationRows(queryPageRows) {
    /** @type {Record<string, { keyword: string, pages: Array<{ url: string, position: number, clicks: number }> }>} */
    const groups = {};

    for (const row of queryPageRows || []) {
        const keyword = row.keys?.[0];
        const page = pathFromGscPage(row.keys?.[1]);
        if (!keyword || !page) continue;
        const norm = normalizeKeyword(keyword);
        if (!groups[norm]) groups[norm] = { keyword, pages: [] };
        groups[norm].pages.push({
            url: page,
            position: Number(row.position) || 20,
            clicks: row.clicks || 0,
        });
    }

    const rows = [];
    for (const g of Object.values(groups)) {
        const uniquePages = [...new Map(g.pages.map((p) => [p.url, p])).values()];
        if (uniquePages.length < 2) continue;

        uniquePages.sort((a, b) => a.position - b.position);
        const positions = uniquePages.map((p) => p.position);
        const minPos = Math.min(...positions);
        const maxPos = Math.max(...positions);
        const strongest = uniquePages[0];
        const totalClicks = uniquePages.reduce((s, p) => s + p.clicks, 0);

        rows.push({
            id: normalizeKeyword(g.keyword),
            keyword: g.keyword,
            url_count: uniquePages.length,
            strongest_url: strongest.url,
            position_min: Math.round(minPos * 10) / 10,
            position_max: Math.round(maxPos * 10) / 10,
            position_spread_label: `${minPos.toFixed(1)}–${maxPos.toFixed(1)}`,
            clicks: totalClicks,
            urls: uniquePages,
        });
    }

    rows.sort((a, b) => b.url_count - a.url_count || b.clicks - a.clicks);
    return rows.slice(0, 50);
}

export function buildBrandClicksDaily(dateQueryRows, brandTerms) {
    /** @type {Record<string, { branded: number, nonBranded: number }>} */
    const byDate = {};

    for (const row of dateQueryRows || []) {
        const date = row.keys?.[0];
        const query = row.keys?.[1];
        if (!date || !query) continue;
        if (!byDate[date]) byDate[date] = { branded: 0, nonBranded: 0 };
        const clicks = row.clicks || 0;
        if (isBrandQuery(query, brandTerms)) byDate[date].branded += clicks;
        else byDate[date].nonBranded += clicks;
    }

    return Object.keys(byDate)
        .sort()
        .map((date) => ({
            date,
            branded: byDate[date].branded,
            nonBranded: byDate[date].nonBranded,
        }));
}

export function buildDemoInsightsBundle() {
    const template = getDemoPayload("seoInsights") || {};
    if (template.volumePotential) {
        return template;
    }

    const volumePotential = buildDemoVolumePotentialRows().map((r) => ({
        ...r,
        clicks_now: r.clicks_now,
        potential_clicks: r.potential_clicks,
    }));

    const keywordOverview = [
        ["product photography prices", 2297, 4, 123, 5.4, -7.8, -1],
        ["video production copenhagen", 1532, 5, 98, 4.8, -5.2, 2],
        ["packshots", 980, 6, 72, 3.9, 1.1, -0.5],
    ].map(([keyword, volume, position, clicks, ctr, volYoy, posDelta], i) => ({
        id: `demo-kw-${i}`,
        keyword,
        volume,
        volume_yoy_pct: volYoy,
        position,
        position_yoy: posDelta,
        clicks,
        clicks_yoy_pct: -12.8,
        ctr,
        ctr_yoy_pp: -5.1,
        spend_saved: clicks * 14.2,
    }));

    const topLandingPages = [
        ["/product-photography", 312, 17633, 1.77, 5.3, 44194, 5595],
        ["/video-production", 198, 11200, 1.77, 6.1, 28000, 3550],
    ].map(([url, clicks, impressions, ctr, position, value, spend_saved], i) => ({
        id: `demo-url-${i}`,
        url,
        clicks,
        clicks_yoy_pct: -7.9,
        impressions,
        impressions_yoy_pct: -6.2,
        ctr,
        ctr_yoy_pct: -4.1,
        position,
        position_yoy: -0.42,
        value,
        spend_saved,
    }));

    const cannibalization = [
        {
            id: "demo-can-1",
            keyword: "product photography",
            url_count: 3,
            strongest_url: "/product-photography",
            position_min: 4.2,
            position_max: 18.6,
            position_spread_label: "4.2–18.6",
            clicks: 245,
            urls: [
                { url: "/product-photography", position: 4.2, clicks: 180 },
                { url: "/services/photo", position: 12.1, clicks: 45 },
                { url: "/blog/product-photos", position: 18.6, clicks: 20 },
            ],
        },
    ];

    const days = 26;
    const brandClicksDaily = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const date = d.toISOString().slice(0, 10);
        const h = numHash(`brand-${date}`);
        return {
            date,
            nonBranded: 35 + (h % 25),
            branded: 12 + (h % 15),
        };
    });

    return {
        volumePotential,
        keywordOverview,
        topLandingPages,
        cannibalization,
        brandClicksDaily,
    };
}

export async function buildSeoInsightsBundle({
    customerId,
    siteUrl,
    startDate,
    endDate,
    compareStartDate,
    compareEndDate,
    gscKeywords,
    gscKeywordsPrev,
    gscPages,
    gscPagesPrev,
    gscQueryPage,
    gscDateQuery,
    supplemental,
    brandTerms,
    filterConfig,
}) {
    if (customerId && isDemoCustomerId(customerId)) {
        return buildDemoInsightsBundle();
    }

    const groupFiltersActive = hasActiveKeywordGroupFilters(filterConfig);
    const filteredKeywords = groupFiltersActive
        ? filterGscQueryRows(gscKeywords, filterConfig)
        : gscKeywords;
    const filteredKeywordsPrev = groupFiltersActive
        ? filterGscQueryRows(gscKeywordsPrev, filterConfig)
        : gscKeywordsPrev;
    const filteredQueryPage = groupFiltersActive
        ? (gscQueryPage || []).filter((row) =>
              queryMatchesKeywordGroupFilters(row.keys?.[0], filterConfig)
          )
        : gscQueryPage;
    const filteredPages = groupFiltersActive
        ? filterAndAggregateGscPagesFromQueryPage(gscQueryPage, filterConfig)
        : gscPages;
    const filteredPagesPrev = gscPagesPrev;

    const economics = economicsFromSupplemental(filteredKeywords, supplemental);
    const volumeByKeyword = await fetchAhrefsVolumeByKeyword(siteUrl, endDate);

    const volumePotential = buildVolumePotentialRows(filteredKeywords, volumeByKeyword, economics);

    const keywordOverview = buildKeywordOverviewRows(
        filteredKeywords,
        filteredKeywordsPrev,
        volumeByKeyword,
        economics
    );

    const topLandingPages = buildTopLandingPagesRows(filteredPages, filteredPagesPrev, economics);

    const cannibalization = buildCannibalizationRows(filteredQueryPage);

    const brandClicksDaily = buildBrandClicksDaily(gscDateQuery, brandTerms);

    const brandMetrics = computeBrandKeywordMetrics(filteredKeywords, brandTerms);

    return {
        volumePotential,
        keywordOverview,
        topLandingPages,
        cannibalization,
        brandClicksDaily,
        meta: { ...economics, brandMetrics },
    };
}
