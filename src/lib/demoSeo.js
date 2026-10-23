import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";
import { TOP3_ORGANIC_CTR } from "@/lib/seoVolumePotential";

/**
 * Seeded demo SEO data for demo customers only (illustrative, not real performance).
 * Deterministic per date range, so a comparison period differs from the current one and the
 * dashboard's winners, losers and trends have something to show.
 */

/** [keyword, impressions per 30 days, average position, landing path, brand] */
const BASE_KEYWORDS = [
    ["demo store", 5200, 1.2, "/", true],
    ["demo brand", 3400, 1.4, "/", true],
    ["demostore hoodie", 1900, 1.9, "/collections/hoodies", true],
    ["demo hoodie", 1500, 1.6, "/products/organic-hoodie", true],
    ["demo store discount code", 900, 2.3, "/", true],
    ["organic cotton hoodie", 9800, 6.2, "/products/organic-hoodie", false],
    ["oversized hoodie women", 12400, 8.4, "/collections/hoodies", false],
    ["heavyweight t-shirt", 8200, 5.1, "/products/heavyweight-tee", false],
    ["sustainable streetwear", 6400, 9.8, "/pages/sustainability", false],
    ["unisex hoodie", 15200, 11.6, "/collections/hoodies", false],
    ["mens zip hoodie", 11800, 7.3, "/collections/hoodies", false],
    ["boxy tee", 5300, 4.4, "/collections/t-shirts", false],
    ["fleece sweatpants", 7600, 13.2, "/collections/joggers", false],
    ["organic cotton t-shirt", 6100, 3.8, "/collections/t-shirts", false],
    ["black oversized t-shirt", 9300, 6.9, "/collections/t-shirts", false],
    ["cropped hoodie", 8800, 14.8, "/collections/hoodies", false],
    ["gots certified clothing", 2100, 3.1, "/pages/sustainability", false],
    ["ethical clothing brands", 14500, 17.4, "/pages/sustainability", false],
    ["hoodie size guide", 3900, 2.6, "/pages/size-guide", false],
    ["how to wash a hoodie", 6800, 5.9, "/blogs/care/how-to-wash-a-hoodie", false],
    ["best hoodie fabric", 4200, 8.1, "/blogs/guides/best-hoodie-fabric", false],
    ["vintage wash hoodie", 4900, 10.4, "/collections/hoodies", false],
    ["embroidered hoodie", 7100, 12.6, "/collections/hoodies", false],
    ["plain white tee", 18200, 19.3, "/collections/t-shirts", false],
    ["grey marl sweatshirt", 3300, 6.3, "/collections/all", false],
    ["pullover hoodie", 13900, 15.7, "/collections/hoodies", false],
    ["relaxed fit joggers", 5800, 9.1, "/collections/joggers", false],
    ["organic cotton joggers", 3000, 4.9, "/collections/joggers", false],
    ["crewneck sweatshirt men", 10200, 12.1, "/collections/all", false],
    ["hoodie for tall men", 2400, 8.8, "/collections/hoodies", false],
    ["athleisure set", 4400, 21.5, "/collections/all", false],
    ["capsule wardrobe basics", 6200, 16.2, "/blogs/guides/best-hoodie-fabric", false],
    ["linen shirt men", 9000, 24.4, "/collections/all", false],
    ["gift ideas for him", 11000, 28.3, "/collections/all", false],
];

/** Keywords that also rank with more than one URL (feeds the cannibalization view). */
const EXTRA_URLS = {
    "unisex hoodie": ["/products/organic-hoodie", "/blogs/guides/best-hoodie-fabric"],
    "organic cotton hoodie": ["/collections/hoodies"],
    "hoodie size guide": ["/collections/hoodies"],
    "oversized hoodie women": ["/products/organic-hoodie"],
    "best hoodie fabric": ["/pages/sustainability"],
    "sustainable streetwear": ["/collections/all", "/pages/sustainability"],
};

const WEEKDAY_FACTOR = [0.86, 1.1, 1.08, 1.05, 1.0, 0.92, 0.8]; // Sun..Sat

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hashUnit = (s) => (numHash(s) % 1000) / 1000; // 0..1

function daysIn(startDate, endDate) {
    return eachDayInclusive(startDate, endDate).length;
}

/** Click-through rate by position: steep top, long tail (demo curve, not a benchmark). */
function ctrAtPosition(position, brand) {
    const p = Math.max(1, position);
    const base = 0.31 * Math.exp(-0.33 * (p - 1)) + 0.004;
    return brand ? Math.min(0.62, base * 1.5) : base;
}

function periodKeywordRows(startDate, endDate) {
    const days = daysIn(startDate, endDate);
    const scale = days / 30;
    return BASE_KEYWORDS.map(([keyword, impr, pos, path, brand]) => {
        const j = 0.82 + hashUnit(`${keyword}|${startDate}`) * 0.4; // 0.82..1.22
        const pj = (hashUnit(`${keyword}|pos|${startDate}`) - 0.5) * 3; // -1.5..1.5
        const position = clamp(pos + pj, 1, 40);
        const impressions = Math.max(1, Math.round(impr * scale * j));
        const ctrJ = 0.8 + hashUnit(`${keyword}|ctr`) * 0.4; // stable per keyword: some snippets underperform
        const ctr = ctrAtPosition(position, brand) * ctrJ;
        const clicks = Math.max(0, Math.round(impressions * ctr));
        return { keyword, brand, path, impressions, clicks, ctr, position };
    });
}

/** Search Console style keyword rows (ctr as a 0..1 fraction). */
export function demoSeoKeywordRows(startDate, endDate) {
    return periodKeywordRows(startDate, endDate)
        .map((r) => ({
            keys: [r.keyword],
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.clicks / r.impressions,
            position: Math.round(r.position * 10) / 10,
        }))
        .sort((a, b) => b.clicks - a.clicks);
}

/** Search Console style page rows. */
export function demoSeoPageRows(startDate, endDate) {
    const byPath = new Map();
    for (const r of periodKeywordRows(startDate, endDate)) {
        const cur = byPath.get(r.path) || { clicks: 0, impressions: 0, posWeight: 0 };
        cur.clicks += r.clicks;
        cur.impressions += r.impressions;
        cur.posWeight += r.position * r.impressions;
        byPath.set(r.path, cur);
    }
    return [...byPath.entries()]
        .map(([path, v]) => ({
            keys: [`https://demo.example.com${path === "/" ? "/" : path}`],
            clicks: v.clicks,
            impressions: v.impressions,
            ctr: v.impressions ? v.clicks / v.impressions : 0,
            position: Math.round((v.posWeight / v.impressions) * 10) / 10,
        }))
        .sort((a, b) => b.clicks - a.clicks);
}

/** Daily rows that add up to the keyword totals, with a weekday rhythm and light noise. */
export function demoSeoDailyRows(startDate, endDate) {
    const dates = eachDayInclusive(startDate, endDate);
    const kw = periodKeywordRows(startDate, endDate);
    const totalClicks = kw.reduce((s, r) => s + r.clicks, 0);
    const totalImpr = kw.reduce((s, r) => s + r.impressions, 0);
    const avgPos = kw.reduce((s, r) => s + r.position * r.impressions, 0) / (totalImpr || 1);

    const weights = dates.map((d) => {
        const dow = new Date(`${d}T12:00:00.000Z`).getUTCDay();
        return WEEKDAY_FACTOR[dow] * (0.92 + hashUnit(`seo-day-${d}`) * 0.16);
    });
    const wSum = weights.reduce((s, w) => s + w, 0) || 1;
    return dates.map((date, i) => ({
        keys: [date],
        clicks: Math.round((totalClicks * weights[i]) / wSum),
        impressions: Math.round((totalImpr * weights[i]) / wSum),
        ctr: totalClicks / (totalImpr || 1),
        position: Math.round((avgPos + (hashUnit(`seo-pos-${date}`) - 0.5) * 1.2) * 100) / 100,
    }));
}

/** Organic revenue, conversions, spend saved and authority scaled to the range's clicks. */
export function demoSeoSupplemental(startDate, endDate, dailyRows) {
    const clicks = (dailyRows || []).reduce((s, r) => s + (r.clicks || 0), 0);
    const convRate = 0.021 + hashUnit(`conv-${startDate}`) * 0.008;
    const conversions = Math.round(clicks * convRate);
    const aov = 290;
    const avgCpc = 14.2;
    const daysFromEnd = Math.max(0, Math.round((Date.now() - new Date(`${endDate}T12:00:00.000Z`).getTime()) / 86400000));
    const organic_daily = (dailyRows || []).map((r) => {
        const conv = Math.round(r.clicks * convRate);
        return { date: r.keys[0], conversions: conv, revenue: conv * aov, sessions: Math.round(r.clicks * 1.08) };
    });
    return {
        organic_revenue: conversions * aov,
        organic_conversions: conversions,
        avg_cpc: avgCpc,
        spend_saved: Math.round(clicks * avgCpc),
        backlinks: Math.max(900, Math.round(1706 - daysFromEnd * 0.9)),
        domain_rating: 38,
        organic_daily,
    };
}

export function buildDemoSeoMetricsPayload(startDate, endDate) {
    const daily = demoSeoDailyRows(startDate, endDate);
    return {
        metrics: { rows: daily },
        keywords: { rows: demoSeoKeywordRows(startDate, endDate) },
        urls: { rows: demoSeoPageRows(startDate, endDate) },
        supplemental: demoSeoSupplemental(startDate, endDate, daily),
        appliedFilters: [],
    };
}

const isBrand = (keyword, brandTerms) => {
    const k = keyword.toLowerCase();
    return (brandTerms || []).some((t) => k.includes(String(t).toLowerCase()));
};

/** Same shape the live insights route returns (volume potential, keywords, pages, cannibalization, brand split). */
export function buildDemoSeoInsights(startDate, endDate, brandTerms = []) {
    const cur = periodKeywordRows(startDate, endDate);
    const supp = demoSeoSupplemental(startDate, endDate, demoSeoDailyRows(startDate, endDate));
    const totalClicks = cur.reduce((s, r) => s + r.clicks, 0);
    const rpc = totalClicks > 0 ? supp.organic_revenue / totalClicks : null;
    const cpc = supp.avg_cpc;

    const yoyStart = `${Number(startDate.slice(0, 4)) - 1}${startDate.slice(4)}`;
    const yoyEnd = `${Number(endDate.slice(0, 4)) - 1}${endDate.slice(4)}`;
    const prevByKw = new Map(periodKeywordRows(yoyStart, yoyEnd).map((r) => [r.keyword, r]));

    const keywordOverview = cur
        .map((r) => {
            const prev = prevByKw.get(r.keyword);
            const volume = Math.round(r.impressions * 4);
            const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
            return {
                id: r.keyword,
                keyword: r.keyword,
                volume,
                volume_yoy_pct: prev ? pct(volume, Math.round(prev.impressions * 4)) : null,
                position: Math.round(r.position * 10) / 10,
                position_yoy: prev ? Math.round((prev.position - r.position) * 10) / 10 : null,
                clicks: r.clicks,
                clicks_yoy_pct: prev ? pct(r.clicks, prev.clicks) : null,
                ctr: r.ctr * 100,
                ctr_yoy_pp: prev ? (r.ctr - prev.ctr) * 100 : null,
                spend_saved: r.clicks * cpc,
            };
        })
        .sort((a, b) => b.clicks - a.clicks);

    const volumePotential = cur
        .filter((r) => r.position >= 4 && r.position <= 10)
        .map((r) => {
            const volume = Math.round(r.impressions * 4);
            const potential_clicks = Math.round(volume * TOP3_ORGANIC_CTR);
            const uplift = Math.max(0, potential_clicks - r.clicks);
            const value_now = rpc != null ? r.clicks * rpc : null;
            const value_potential = rpc != null ? potential_clicks * rpc : null;
            return {
                id: r.keyword,
                keyword: r.keyword,
                position: Math.round(r.position * 100) / 100,
                volume,
                clicks_now: r.clicks,
                potential_clicks,
                uplift,
                value_now,
                value_potential,
                value_uplift: value_now != null && value_potential != null ? value_potential - value_now : null,
                spend_saved: r.clicks * cpc,
            };
        })
        .sort((a, b) => (b.value_uplift ?? 0) - (a.value_uplift ?? 0) || b.uplift - a.uplift);

    const pageRows = demoSeoPageRows(startDate, endDate);
    const prevPages = new Map(demoSeoPageRows(yoyStart, yoyEnd).map((r) => [r.keys[0], r]));
    const topLandingPages = pageRows.map((r) => {
        const path = r.keys[0].replace("https://demo.example.com", "") || "/";
        const prev = prevPages.get(r.keys[0]);
        const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
        return {
            id: path,
            url: path,
            clicks: r.clicks,
            clicks_yoy_pct: prev ? pct(r.clicks, prev.clicks) : null,
            impressions: r.impressions,
            impressions_yoy_pct: prev ? pct(r.impressions, prev.impressions) : null,
            ctr: r.ctr * 100,
            ctr_yoy_pct: prev ? pct(r.ctr, prev.ctr) : null,
            position: r.position,
            position_yoy: prev ? Math.round((prev.position - r.position) * 10) / 10 : null,
            value: rpc != null ? r.clicks * rpc : null,
            spend_saved: r.clicks * cpc,
        };
    });

    const cannibalization = Object.entries(EXTRA_URLS)
        .map(([keyword, extra]) => {
            const main = cur.find((r) => r.keyword === keyword);
            if (!main) return null;
            const urls = [
                { url: main.path, position: main.position, clicks: Math.round(main.clicks * 0.72) },
                ...extra.map((url, i) => ({
                    url,
                    position: clamp(main.position + 3.5 + i * 5.5 + hashUnit(`${keyword}${url}`) * 2, 1, 40),
                    clicks: Math.round(main.clicks * (0.2 - i * 0.07)),
                })),
            ].sort((a, b) => a.position - b.position);
            const positions = urls.map((u) => u.position);
            const lo = Math.min(...positions);
            const hi = Math.max(...positions);
            return {
                id: keyword,
                keyword,
                url_count: urls.length,
                strongest_url: urls[0].url,
                position_min: Math.round(lo * 10) / 10,
                position_max: Math.round(hi * 10) / 10,
                position_spread_label: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
                clicks: urls.reduce((s, u) => s + u.clicks, 0),
                urls,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.url_count - a.url_count || b.clicks - a.clicks);

    const brandShare = cur.filter((r) => isBrand(r.keyword, brandTerms)).reduce((s, r) => s + r.clicks, 0) / (totalClicks || 1);
    const brandClicksDaily = demoSeoDailyRows(startDate, endDate).map((d) => {
        const share = clamp(brandShare + (hashUnit(`brand-${d.keys[0]}`) - 0.5) * 0.06, 0, 1);
        const branded = Math.round(d.clicks * share);
        return { date: d.keys[0], branded, nonBranded: d.clicks - branded };
    });

    return {
        volumePotential,
        keywordOverview,
        topLandingPages,
        cannibalization,
        brandClicksDaily,
        meta: { avgCpc: cpc, revenuePerClick: rpc },
    };
}
