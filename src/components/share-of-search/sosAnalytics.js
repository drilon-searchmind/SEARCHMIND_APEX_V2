/**
 * Derived numbers for the Share of Search results. Everything here is computed from the rows the
 * Keyword Planner returned, nothing is estimated beyond what the existing share fields already hold.
 */

const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Percentage points between the current share and a comparison share, or null when there is none. */
export function pointChange(row, field) {
    const now = num(row?.sharePct);
    const before = num(row?.[field]);
    if (now == null || before == null) return null;
    return Math.round((now - before) * 100) / 100;
}

/**
 * @param {Array<Record<string, unknown>>} rows display rows (grouped or not)
 * @param {Array<{ name: string, label?: string, data: number[] }>} lineSeries monthly volumes per row
 * @param {string[]} categories month labels matching the series
 */
export function buildInsights(rows, lineSeries, categories) {
    const list = Array.isArray(rows) ? rows : [];
    const withChange = list
        .map((r) => ({ row: r, change: pointChange(r, "sharePctPreviousPeriod") }))
        .filter((x) => x.change != null);

    const gainer = withChange.length ? withChange.reduce((a, b) => (b.change > a.change ? b : a)) : null;
    const decliner = withChange.length ? withChange.reduce((a, b) => (b.change < a.change ? b : a)) : null;

    let peak = null;
    if (lineSeries?.length && categories?.length) {
        const totals = categories.map((_, i) => lineSeries.reduce((s, ser) => s + (Number(ser.data[i]) || 0), 0));
        const max = Math.max(...totals);
        if (max > 0) peak = { label: categories[totals.indexOf(max)], volume: max };
    }

    return {
        gainer: gainer && gainer.change > 0 ? gainer : null,
        decliner: decliner && decliner.change < 0 ? decliner : null,
        peak,
    };
}

function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, rows) {
    return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(filename, text) {
    const blob = new Blob(["﻿", text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
