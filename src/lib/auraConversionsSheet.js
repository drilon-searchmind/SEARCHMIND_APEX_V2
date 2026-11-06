/**
 * Reads the daily Emob conversions ("Conversions" tab, column D) and the daily "Other" cost
 * ("Campaigns Cost" tab, column D) from the Aura conversions Google Sheet, the same source the old
 * Supermetrics dashboard imported with IMPORTRANGE (see custom-dashboards/aura/SHEET_LOGIC.md).
 * The file is shared "anyone with the link can view", so the public gviz endpoint is used. Server only.
 */

const DEFAULT_SHEET_ID = "1oAOXZJEwL2dmodud8ll8WRc4scs4uBYVcVE3hJfYUF0";

/** The only customer allowed to read this sheet through the API. */
export const AURA_CUSTOMER_NAME = "Aura DK";

const GVIZ_PREFIX = /^[^(]*\(/;
const GVIZ_SUFFIX = /\);?\s*$/;

function sheetId() {
    return process.env.AURA_CONVERSIONS_SHEET_ID || DEFAULT_SHEET_ID;
}

/** "Date(2026,9,1)" (month is 0 based) to "2026-10-01". */
function gvizDateToIso(raw) {
    const m = /^Date\((\d+),(\d+),(\d+)\)$/.exec(String(raw || ""));
    if (!m) return null;
    return `${m[1]}-${String(Number(m[2]) + 1).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
}

async function fetchTab(tab, startDate, endDate) {
    const query = `select B, D where B >= date '${startDate}' and B <= date '${endDate}' order by B`;
    const url =
        `https://docs.google.com/spreadsheets/d/${sheetId()}/gviz/tq?tqx=out:json` +
        `&sheet=${encodeURIComponent(tab)}&tq=${encodeURIComponent(query)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Aura sheet "${tab}" request failed (${res.status})`);
    const text = await res.text();
    const json = JSON.parse(text.replace(GVIZ_PREFIX, "").replace(GVIZ_SUFFIX, ""));
    if (json.status !== "ok") {
        throw new Error(json.errors?.[0]?.detailed_message || `Aura sheet "${tab}" returned ${json.status}`);
    }
    return (json.table?.rows || [])
        .map((row) => ({
            date: gvizDateToIso(row.c?.[0]?.v),
            value: Number(row.c?.[1]?.v) || 0,
        }))
        .filter((r) => r.date);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Daily conversions and other cost between two ISO dates (inclusive). */
export async function fetchAuraSheetData(startDate, endDate) {
    if (!ISO.test(startDate) || !ISO.test(endDate)) throw new Error("Invalid date range");
    const [conversions, otherCost] = await Promise.all([
        fetchTab("Conversions", startDate, endDate),
        fetchTab("Campaigns Cost", startDate, endDate),
    ]);
    return { conversions, otherCost };
}
