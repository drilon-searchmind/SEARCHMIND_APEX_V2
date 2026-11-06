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

/** gid of the "Conversions" tab. Its older rows are hidden, which gviz skips, so it is read through the CSV export. */
const CONVERSIONS_GID = "0";

/** Splits one CSV line (handles quoted fields). */
function splitCsvLine(line) {
    const out = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') {
                cur += '"';
                i += 1;
            } else if (ch === '"') quoted = false;
            else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") {
            out.push(cur);
            cur = "";
        } else cur += ch;
    }
    out.push(cur);
    return out;
}

/** "d/m/yyyy" (the sheet's locale) to "yyyy-mm-dd". */
function dmyToIso(raw) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(raw || "").trim());
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** "4,25" or "1.234,5" (Danish decimals) to a number. */
function parseSheetNumber(raw) {
    const t = String(raw ?? "").trim();
    if (!t) return 0;
    const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    return Number.isFinite(n) ? n : 0;
}

/** Daily Emob conversions (column D) between two ISO dates, including rows hidden in the sheet. */
async function fetchConversions(startDate, endDate) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId()}/export?format=csv&gid=${CONVERSIONS_GID}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Aura sheet "Conversions" request failed (${res.status})`);
    const lines = (await res.text()).split("\n");
    const rows = [];
    for (const line of lines) {
        const cols = splitCsvLine(line);
        const date = dmyToIso(cols[1]);
        if (date && date >= startDate && date <= endDate) rows.push({ date, value: parseSheetNumber(cols[3]) });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** Daily conversions and other cost between two ISO dates (inclusive). */
export async function fetchAuraSheetData(startDate, endDate) {
    if (!ISO.test(startDate) || !ISO.test(endDate)) throw new Error("Invalid date range");
    const [conversions, otherCost] = await Promise.all([
        fetchConversions(startDate, endDate),
        fetchTab("Campaigns Cost", startDate, endDate),
    ]);
    return { conversions, otherCost };
}
