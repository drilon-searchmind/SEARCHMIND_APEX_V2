/**
 * Build tab-separated + plain-text exports for Performance Investigator
 * (paste into Google Slides, Google Sheets, or PowerPoint tables).
 */

import {
    PI_METRIC_HEADERS,
    PI_METRIC_KEYS,
    aggregatePiRows,
    computePiYearOverYearDiff,
} from "@/app/(protected)/apex-radar/lib/mockPerformanceInvestigatorData";

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

function formatMetricCell(key, value) {
    if (value == null || Number.isNaN(value)) return "";
    switch (key) {
        case "impr":
        case "clicks":
        case "conv":
            return intFmt.format(value);
        case "ctr":
        case "convRate":
            return pctFmt.format(value);
        case "freq":
        case "avgCpc":
            return dec2.format(value);
        case "cost":
        case "convValue":
        case "aov":
        case "cpa":
            return dec2.format(value);
        case "roas":
            return dec1.format(value);
        default:
            return String(value);
    }
}

function formatDiffCell(pct) {
    if (pct == null || Number.isNaN(pct)) return "";
    const sign = pct > 0 ? "+" : "";
    return `${sign}${dec1.format(pct)}%`.replace("-", "−");
}

/** Same column order as the on-screen funnel */
const FUNNEL_ORDER = [
    "convValue",
    "conversions",
    "aov",
    "convRate",
    "clicks",
    "ctr",
    "cpc",
    "impr",
    "cost",
    "freq",
];

function formatFunnelChange(pct) {
    if (pct == null || Number.isNaN(pct)) return "—";
    if (pct === 0) return "0%";
    const sign = pct > 0 ? "+" : "";
    const n = dec1.format(Math.abs(pct));
    return `${sign}${n}%`;
}

function tsvLine(cells) {
    return cells.map((c) => String(c ?? "").replace(/\t/g, " ")).join("\t");
}

function buildMonthlyTableTsv(title, rows, footerRows = []) {
    const header = ["Period", ...PI_METRIC_HEADERS.map((h) => h.replace(/\./g, ""))];
    const lines = [title, tsvLine(header)];
    for (const row of rows) {
        const cells = [row.label, ...PI_METRIC_KEYS.map((k) => formatMetricCell(k, row[k]))];
        lines.push(tsvLine(cells));
    }
    for (const fr of footerRows) {
        const cells = [fr.label, ...PI_METRIC_KEYS.map((k) => formatMetricCell(k, fr[k]))];
        lines.push(tsvLine(cells));
    }
    lines.push("");
    return lines.join("\n");
}

function buildDiffTableTsv(title, rows) {
    const header = ["Period", ...PI_METRIC_HEADERS.map((h) => `${h} (Δ%)`)];
    const lines = [title, tsvLine(header)];
    for (const row of rows) {
        const cells = [
            row.label,
            ...PI_METRIC_KEYS.map((k) => formatDiffCell(row.pct?.[k])),
        ];
        lines.push(tsvLine(cells));
    }
    lines.push("");
    return lines.join("\n");
}

function buildFunnelTsv(title, funnel) {
    if (!funnel) return `${title}\n(no funnel data)\n\n`;
    const lines = [
        title,
        tsvLine(["Metric", "Value", "Change vs prior period"]),
    ];
    for (const key of FUNNEL_ORDER) {
        const node = funnel[key];
        if (!node) continue;
        lines.push(
            tsvLine([
                node.label || key,
                node.value ?? "",
                formatFunnelChange(node.changePct),
            ])
        );
    }
    lines.push("");
    return lines.join("\n");
}

const MONTHLY_HEADER_CELLS = () => [
    "Period",
    ...PI_METRIC_HEADERS.map((h) => h.replace(/\./g, "")),
];

const DIFF_HEADER_CELLS = () => [
    "Period",
    ...PI_METRIC_HEADERS.map((h) => `${h} (Δ%)`),
];

function rowToMetricCells(row) {
    return [row.label, ...PI_METRIC_KEYS.map((k) => formatMetricCell(k, row[k]))];
}

function rowToDiffCells(row) {
    return [row.label, ...PI_METRIC_KEYS.map((k) => formatDiffCell(row.pct?.[k]))];
}

/**
 * Shared PI export context for clipboard text and Google Slides API deck.
 * @param {object} params
 */
function computePerformanceInvestigatorExportContext({
    title = "Performance Investigator",
    customerLabel = "",
    currentYear,
    previousYear,
    currentYearRows = [],
    previousYearRows = [],
    diffRows: diffRowsProp,
    funnel = null,
    funnelRange = null,
    compareHint = null,
}) {
    const cy = currentYear ?? new Date().getUTCFullYear();
    const py = previousYear ?? cy - 1;

    const diffRows =
        diffRowsProp?.length > 0
            ? diffRowsProp
            : currentYearRows.length && previousYearRows.length
              ? computePiYearOverYearDiff(currentYearRows, previousYearRows)
              : [];

    const currentFooter = (() => {
        const rows = currentYearRows.filter((r) => r.impr != null);
        const t = aggregatePiRows(rows);
        return t ? [t] : [];
    })();

    const monthsWithData = currentYearRows.filter((r) => r.impr != null).length;
    const prevYtdFooter =
        monthsWithData > 0 ? aggregatePiRows(previousYearRows.slice(0, monthsWithData)) : null;
    const prevFullFooter = aggregatePiRows(previousYearRows.filter((r) => r.impr != null));

    const prevFooters = [];
    if (prevYtdFooter) prevFooters.push({ ...prevYtdFooter, label: "Total år-til-dato" });
    if (prevFullFooter) prevFooters.push({ ...prevFullFooter, label: "Total hele år" });

    const metaLines = [
        `${title}${customerLabel ? ` — ${customerLabel}` : ""}`,
        `Monthly tables: ${cy} vs ${py}`,
    ];
    if (funnelRange?.startDate && funnelRange?.endDate) {
        metaLines.push(`Funnel period: ${funnelRange.startDate} → ${funnelRange.endDate}`);
    }
    if (funnelRange?.compareStart && funnelRange?.compareEnd) {
        metaLines.push(`Funnel comparison period: ${funnelRange.compareStart} → ${funnelRange.compareEnd}`);
    }
    if (compareHint) metaLines.push(compareHint);

    const monthlyHeader = MONTHLY_HEADER_CELLS();
    const currentDataRows = [
        ...currentYearRows.map(rowToMetricCells),
        ...currentFooter.map(rowToMetricCells),
    ];
    const previousDataRows = [
        ...previousYearRows.map(rowToMetricCells),
        ...prevFooters.map(rowToMetricCells),
    ];
    const diffDataRows = diffRows.map(rowToDiffCells);

    const funnelHeader = ["Metric", "Value", "Change vs prior period"];
    const funnelDataRows = [];
    if (funnel) {
        for (const key of FUNNEL_ORDER) {
            const node = funnel[key];
            if (!node) continue;
            funnelDataRows.push([
                node.label || key,
                node.value ?? "",
                formatFunnelChange(node.changePct),
            ]);
        }
    }

    return {
        cy,
        py,
        metaLines,
        monthlyHeader,
        currentDataRows,
        previousDataRows,
        diffRows,
        diffHeader: DIFF_HEADER_CELLS(),
        diffDataRows,
        funnelHeader,
        funnelDataRows,
        funnel,
    };
}

/**
 * @param {object} params
 * @returns {{ text: string, plainSummary: string }}
 */
export function buildPerformanceInvestigatorSlidesCopy(params) {
    const ctx = computePerformanceInvestigatorExportContext(params);

    const currentFooter = (() => {
        const rows = (params.currentYearRows ?? []).filter((r) => r.impr != null);
        const t = aggregatePiRows(rows);
        return t ? [t] : [];
    })();

    const pyFooters = (() => {
        const currentYearRows = params.currentYearRows ?? [];
        const previousYearRows = params.previousYearRows ?? [];
        const monthsWithData = currentYearRows.filter((r) => r.impr != null).length;
        const prevYtdFooter =
            monthsWithData > 0 ? aggregatePiRows(previousYearRows.slice(0, monthsWithData)) : null;
        const prevFullFooter = aggregatePiRows(previousYearRows.filter((r) => r.impr != null));
        const prevFooters = [];
        if (prevYtdFooter) prevFooters.push({ ...prevYtdFooter, label: "Total år-til-dato" });
        if (prevFullFooter) prevFooters.push({ ...prevFullFooter, label: "Total hele år" });
        return prevFooters;
    })();

    const textParts = [
        ctx.metaLines.join("\n"),
        "",
        buildMonthlyTableTsv(`MONTHLY METRICS (${ctx.cy})`, params.currentYearRows ?? [], currentFooter),
        buildMonthlyTableTsv(`MONTHLY METRICS (${ctx.py})`, params.previousYearRows ?? [], pyFooters),
        ctx.diffRows.length
            ? buildDiffTableTsv(`DIFFERENCE (YEAR OVER YEAR — ${ctx.cy} vs ${ctx.py})`, ctx.diffRows)
            : "",
        buildFunnelTsv("PERFORMANCE FUNNEL (SELECTED DATE RANGE)", params.funnel),
    ];

    const text = textParts.filter(Boolean).join("\n");

    const plainSummary = [
        ctx.metaLines[0],
        "",
        `Paste into Google Slides: Insert → Table, or paste into Google Sheets then copy the grid into Slides.`,
    ].join("\n");

    return { text, plainSummary };
}

/**
 * Structured deck for Google Slides API (one slide per section, tables instead of one text blob).
 * @param {object} params — same shape as buildPerformanceInvestigatorSlidesCopy
 * @returns {{ slides: Array<{ kind: string, [key: string]: unknown }> }}
 */
export function buildPerformanceInvestigatorSlidesApiPlan(params) {
    const ctx = computePerformanceInvestigatorExportContext(params);
    const slides = [];

    slides.push({
        kind: "intro",
        title: ctx.metaLines[0] ?? "Performance Investigator",
        lines: ctx.metaLines.slice(1),
    });

    slides.push({
        kind: "metricsTable",
        slideTitle: `Monthly metrics (${ctx.cy})`,
        headerRow: ctx.monthlyHeader,
        dataRows: ctx.currentDataRows,
    });

    slides.push({
        kind: "metricsTable",
        slideTitle: `Monthly metrics (${ctx.py})`,
        headerRow: ctx.monthlyHeader,
        dataRows: ctx.previousDataRows,
    });

    if (ctx.diffRows.length > 0) {
        slides.push({
            kind: "diffTable",
            slideTitle: `Difference (YoY — ${ctx.cy} vs ${ctx.py})`,
            headerRow: ctx.diffHeader,
            dataRows: ctx.diffDataRows,
        });
    }

    slides.push({
        kind: "funnelTable",
        slideTitle: "Performance funnel (selected date range)",
        headerRow: ctx.funnelHeader,
        dataRows: ctx.funnelDataRows,
    });

    return { slides };
}

export function parsePresentationIdFromInput(input) {
    if (!input || typeof input !== "string") return null;
    const s = input.trim();
    const m = s.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{25,}$/.test(s)) return s;
    return null;
}
