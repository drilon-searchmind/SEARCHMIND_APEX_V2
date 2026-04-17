/**
 * Static demo data for Performance Investigator (replace with API later).
 * Numbers are raw values; components format with da-DK style.
 */

export const PI_MONTH_LABELS = [
    "jan.",
    "feb.",
    "mar.",
    "apr.",
    "maj",
    "jun.",
    "jul.",
    "aug.",
    "sep.",
    "okt.",
    "nov.",
    "dec.",
];

/** Column metric keys in display order */
export const PI_METRIC_KEYS = [
    "impr",
    "clicks",
    "ctr",
    "freq",
    "avgCpc",
    "cost",
    "conv",
    "convValue",
    "convRate",
    "aov",
    "roas",
    "cpa",
];

export const PI_METRIC_HEADERS = [
    "Impr.",
    "Clicks",
    "CTR",
    "Frequency",
    "Avg. CPC",
    "Cost",
    "Conversions",
    "Conv. value",
    "Conv. rate",
    "AOV",
    "ROAS",
    "CPA",
];

/** 2026 — data through apr.; rest null */
export const MOCK_PI_CURRENT_YEAR_ROWS = [
    {
        label: "jan.",
        impr: 120507,
        clicks: 2012,
        ctr: 0.0167,
        freq: 1.18,
        avgCpc: 5.82,
        cost: 11710,
        conv: 89,
        convValue: 428900,
        convRate: 0.0442,
        aov: 4820,
        roas: 36.6,
        cpa: 131.6,
    },
    {
        label: "feb.",
        impr: 118200,
        clicks: 1988,
        ctr: 0.0168,
        freq: 1.15,
        avgCpc: 5.91,
        cost: 11749,
        conv: 92,
        convValue: 441040,
        convRate: 0.0463,
        aov: 4794,
        roas: 37.5,
        cpa: 127.7,
    },
    {
        label: "mar.",
        impr: 132400,
        clicks: 2156,
        ctr: 0.0163,
        freq: 1.22,
        avgCpc: 6.05,
        cost: 13044,
        conv: 98,
        convValue: 475160,
        convRate: 0.0455,
        aov: 4849,
        roas: 36.4,
        cpa: 133.1,
    },
    {
        label: "apr.",
        impr: 128900,
        clicks: 2090,
        ctr: 0.0162,
        freq: 1.2,
        avgCpc: 6.12,
        cost: 12791,
        conv: 94,
        convValue: 451880,
        convRate: 0.045,
        aov: 4807,
        roas: 35.3,
        cpa: 136.1,
    },
    ...PI_MONTH_LABELS.slice(4).map((label) => ({
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
    })),
];

/** 2025 — full year */
export const MOCK_PI_PREV_YEAR_ROWS = [
    {
        label: "jan.",
        impr: 98500,
        clicks: 1755,
        ctr: 0.0178,
        freq: 1.12,
        avgCpc: 5.2,
        cost: 9126,
        conv: 72,
        convValue: 352080,
        convRate: 0.041,
        aov: 4890,
        roas: 38.6,
        cpa: 126.75,
    },
    {
        label: "feb.",
        impr: 101200,
        clicks: 1820,
        ctr: 0.018,
        freq: 1.1,
        avgCpc: 5.35,
        cost: 9737,
        conv: 76,
        convValue: 371880,
        convRate: 0.0418,
        aov: 4893,
        roas: 38.2,
        cpa: 128.12,
    },
    {
        label: "mar.",
        impr: 110800,
        clicks: 1950,
        ctr: 0.0176,
        freq: 1.16,
        avgCpc: 5.48,
        cost: 10686,
        conv: 81,
        convValue: 396720,
        convRate: 0.0415,
        aov: 4898,
        roas: 37.1,
        cpa: 131.93,
    },
    {
        label: "apr.",
        impr: 108400,
        clicks: 1910,
        ctr: 0.0176,
        freq: 1.14,
        avgCpc: 5.55,
        cost: 10601,
        conv: 79,
        convValue: 386110,
        convRate: 0.0414,
        aov: 4887,
        roas: 36.4,
        cpa: 134.19,
    },
    {
        label: "maj",
        impr: 115600,
        clicks: 2040,
        ctr: 0.0176,
        freq: 1.19,
        avgCpc: 5.62,
        cost: 11465,
        conv: 85,
        convValue: 416500,
        convRate: 0.0417,
        aov: 4900,
        roas: 36.3,
        cpa: 134.88,
    },
    {
        label: "jun.",
        impr: 112300,
        clicks: 1995,
        ctr: 0.0178,
        freq: 1.17,
        avgCpc: 5.58,
        cost: 11132,
        conv: 83,
        convValue: 405850,
        convRate: 0.0416,
        aov: 4890,
        roas: 36.5,
        cpa: 134.12,
    },
    {
        label: "jul.",
        impr: 118900,
        clicks: 2088,
        ctr: 0.0176,
        freq: 1.2,
        avgCpc: 5.65,
        cost: 11797,
        conv: 88,
        convValue: 430120,
        convRate: 0.0421,
        aov: 4888,
        roas: 36.5,
        cpa: 134.06,
    },
    {
        label: "aug.",
        impr: 116200,
        clicks: 2055,
        ctr: 0.0177,
        freq: 1.18,
        avgCpc: 5.6,
        cost: 11508,
        conv: 86,
        convValue: 420860,
        convRate: 0.0419,
        aov: 4894,
        roas: 36.6,
        cpa: 133.81,
    },
    {
        label: "sep.",
        impr: 121000,
        clicks: 2120,
        ctr: 0.0175,
        freq: 1.21,
        avgCpc: 5.68,
        cost: 12042,
        conv: 90,
        convValue: 440100,
        convRate: 0.0425,
        aov: 4890,
        roas: 36.5,
        cpa: 133.8,
    },
    {
        label: "okt.",
        impr: 124500,
        clicks: 2180,
        ctr: 0.0175,
        freq: 1.23,
        avgCpc: 5.72,
        cost: 12470,
        conv: 92,
        convValue: 449880,
        convRate: 0.0422,
        aov: 4890,
        roas: 36.1,
        cpa: 135.54,
    },
    {
        label: "nov.",
        impr: 128800,
        clicks: 2245,
        ctr: 0.0174,
        freq: 1.25,
        avgCpc: 5.75,
        cost: 12909,
        conv: 95,
        convValue: 464550,
        convRate: 0.0423,
        aov: 4890,
        roas: 36.0,
        cpa: 135.88,
    },
    {
        label: "dec.",
        impr: 131200,
        clicks: 2290,
        ctr: 0.0175,
        freq: 1.26,
        avgCpc: 5.78,
        cost: 13236,
        conv: 97,
        convValue: 474330,
        convRate: 0.0424,
        aov: 4890,
        roas: 35.8,
        cpa: 136.45,
    },
];

/** YoY % change per month row (aligned by index: jan vs jan, …). */
export function computePiYearOverYearDiff(currentYearRows, previousYearRows) {
    return currentYearRows.map((cur, i) => {
        const prev = previousYearRows[i];
        const pct = {};
        for (const k of PI_METRIC_KEYS) {
            const a = cur[k];
            const b = prev?.[k];
            if (a == null || b == null || b === 0) {
                pct[k] = null;
            } else {
                pct[k] = ((a - b) / Math.abs(b)) * 100;
            }
        }
        return { label: cur.label, pct };
    });
}

/** Aggregate monthly rows into a Total row (sums + derived metrics). */
export function aggregatePiRows(rows) {
    const valid = rows.filter(
        (r) =>
            r.impr != null &&
            r.clicks != null &&
            r.cost != null &&
            r.conv != null &&
            r.convValue != null
    );
    if (!valid.length) return null;
    let impr = 0;
    let clicks = 0;
    let cost = 0;
    let conv = 0;
    let convValue = 0;
    let freqW = 0;
    for (const r of valid) {
        impr += r.impr;
        clicks += r.clicks;
        cost += r.cost;
        conv += r.conv;
        convValue += r.convValue;
        if (r.freq != null) freqW += r.freq * r.impr;
    }
    const ctr = impr > 0 ? clicks / impr : null;
    const freq = impr > 0 ? freqW / impr : null;
    const avgCpc = clicks > 0 ? cost / clicks : null;
    const convRate = clicks > 0 ? conv / clicks : null;
    const aov = conv > 0 ? convValue / conv : null;
    const roas = cost > 0 ? convValue / cost : null;
    const cpa = conv > 0 ? cost / conv : null;
    return {
        label: "Total",
        impr,
        clicks,
        ctr,
        freq,
        avgCpc,
        cost,
        conv,
        convValue,
        convRate,
        aov,
        roas,
        cpa,
    };
}

/** @deprecated Use computePiYearOverYearDiff(MOCK_PI_CURRENT_YEAR_ROWS, MOCK_PI_PREV_YEAR_ROWS) for demos. */
export const MOCK_PI_DIFF_ROWS = computePiYearOverYearDiff(MOCK_PI_CURRENT_YEAR_ROWS, MOCK_PI_PREV_YEAR_ROWS);

/** Funnel nodes — static demo */
export const MOCK_PI_FUNNEL = {
    convValue: { value: "0", changePct: -100, label: "Conv. value" },
    conversions: { value: "1", changePct: -87.5, label: "Conversions" },
    aov: { value: "0", changePct: -100, label: "AOV" },
    convRate: { value: "0,09%", changePct: -64.21, label: "Conv. Rate" },
    clicks: { value: "1.172", changePct: -65.08, label: "Clicks" },
    ctr: { value: "1,67%", changePct: -17.9, label: "CTR" },
    cpc: { value: "6,27", changePct: 87.15, label: "CpC" },
    impr: { value: "70.277", changePct: -57.46, label: "Impr." },
    cost: { value: "7.351", changePct: -34.64, label: "Cost" },
    freq: { value: "1,24", changePct: 12.7, label: "Freq" },
};

/** Demo payload for `/api/apex-radar/facebook/performance-investigator` (demo customer ids). */
export function getDemoFacebookPerformanceInvestigatorPayload(currentYear, previousYear) {
    return {
        currentYear,
        previousYear,
        currentYearRows: MOCK_PI_CURRENT_YEAR_ROWS,
        previousYearRows: MOCK_PI_PREV_YEAR_ROWS,
        diffRows: computePiYearOverYearDiff(MOCK_PI_CURRENT_YEAR_ROWS, MOCK_PI_PREV_YEAR_ROWS),
        funnel: MOCK_PI_FUNNEL,
        source: "demo",
    };
}
