/**
 * Import Aura hand-entered inputs from Google Sheets into CustomDashboardInput.
 *
 * Sources (hub: AURA x Searchmind // Dashboard, budget, SoS mm.):
 *   - Conversions + Campaign budgets: .../1oAOXZJEwL2dmodud8ll8WRc4scs4uBYVcVE3hJfYUF0
 *   - Monthly goals: per-product Performance Dashboard workbooks (Config tab)
 *
 *   node scripts/aura-import-aura-inputs-from-sheet.mjs
 *   node scripts/aura-import-aura-inputs-from-sheet.mjs --dry-run
 *   node scripts/aura-import-aura-inputs-from-sheet.mjs --keys=campaigns,goals
 */
import "dotenv/config";
import mongoose from "mongoose";
import CustomDashboardInput from "../src/models/CustomDashboardInput.js";
import { conversionTotal, sanitizeAuraInput } from "../src/lib/auraInputs.js";

const DATA_SHEET_ID = process.env.AURA_DATA_SHEET_ID || "1oAOXZJEwL2dmodud8ll8WRc4scs4uBYVcVE3hJfYUF0";
const CONVERSIONS_GID = "0";

/** Performance Dashboard workbook IDs (from hub tab “Dashboards & SoS” hyperlinks). */
const PERFORMANCE_SHEET_IDS = {
    emob: process.env.AURA_EMOB_PERFORMANCE_SHEET_ID || "1X0OeAZ2JthvHBT6wIoBivGB7aDAZNlrCk51-lG5TKjo",
    el: process.env.AURA_EL_PERFORMANCE_SHEET_ID || "1PmgnjQBIMi85BqAavpOyeAa32b49f-6M_kOXo0Z1HrU",
    fiber: process.env.AURA_FIBER_PERFORMANCE_SHEET_ID || "1rp3GZcH_sAo_cuo3ynLVARvOpUhyCDnhYdZLQ1GHCn0",
};

const CUSTOMERS = {
    emob: { id: "6a2beefcbe106fcd31646dcb", convCol: 3, breakdown: true, campaignChannel: "Emob" },
    el: { id: "6afebf0ba91ce3d863daee7f", convCol: 2, breakdown: false, campaignChannel: "EL" },
    fiber: { id: "6afebf0ba91ce3d863daee92", convCol: 4, breakdown: false, campaignChannel: "Fiber" },
};

const MONTH_ORDER = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];

const dryRun = process.argv.includes("--dry-run");
const keysArg = process.argv.find((a) => a.startsWith("--keys="));
const KEYS = new Set(
    keysArg
        ? keysArg
              .slice("--keys=".length)
              .split(",")
              .map((k) => k.trim())
        : ["conversions", "campaigns", "goals"]
);

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

function dmyToIso(raw) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(raw || "").trim());
    return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

function parseSheetNumber(raw) {
    const t = String(raw ?? "").trim();
    if (!t) return 0;
    const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    return Number.isFinite(n) ? n : 0;
}

function gvizDateToIso(raw) {
    const m = /^Date\((\d+),(\d+),(\d+)\)$/.exec(String(raw || ""));
    if (!m) return null;
    return `${m[1]}-${String(Number(m[2]) + 1).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
}

function normalizeChannel(raw) {
    const t = String(raw || "").trim();
    if (t === "EL") return "EL";
    if (t === "Fiber") return "Fiber";
    if (/^emob$/i.test(t)) return "Emob";
    return null;
}

async function gvizRows(sheetId, tab, range) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}&range=${encodeURIComponent(range)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheet "${tab}" failed (${res.status})`);
    const text = await res.text();
    if (text.includes('"status":"error"')) throw new Error(`Sheet "${tab}" gviz error`);
    const json = JSON.parse(text.replace(/^[^(]*\(/, "").replace(/\);?\s*$/, ""));
    return json.table?.rows || [];
}

async function fetchConversionsCsv() {
    const url = `https://docs.google.com/spreadsheets/d/${DATA_SHEET_ID}/export?format=csv&gid=${CONVERSIONS_GID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Conversions CSV failed (${res.status})`);
    return (await res.text()).split(/\r?\n/);
}

function parseConversions(lines, { convCol, breakdown }) {
    const raw = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        const cols = splitCsvLine(line);
        const date = dmyToIso(cols[1]);
        if (!date) continue;
        const value = parseSheetNumber(cols[convCol]);
        let row = { date, value, ejeNy: null, ejeEks: null, lejeNy: null, lejeEks: null };
        if (breakdown) {
            const ejeNy = parseSheetNumber(cols[6]);
            const ejeEks = parseSheetNumber(cols[7]);
            const lejeNy = parseSheetNumber(cols[8]);
            const lejeEks = parseSheetNumber(cols[9]);
            const hasBreakdown = ejeNy || ejeEks || lejeNy || lejeEks;
            if (hasBreakdown) {
                row = {
                    date,
                    value: 0,
                    ejeNy: ejeNy || null,
                    ejeEks: ejeEks || null,
                    lejeNy: lejeNy || null,
                    lejeEks: lejeEks || null,
                };
            }
        }
        if (value > 0 || (breakdown && [row.ejeNy, row.ejeEks, row.lejeNy, row.lejeEks].some((p) => p > 0))) {
            raw.push(row);
        }
    }
    return sanitizeAuraInput("conversions", raw);
}

async function parseCampaigns(channelFilter) {
    const rows = await gvizRows(DATA_SHEET_ID, "Campaign", "A2:L500");
    const raw = [];
    for (const row of rows) {
        const name = String(row.c?.[1]?.v || "").trim();
        const channel = normalizeChannel(row.c?.[2]?.v);
        const budget = Number(row.c?.[3]?.v) || 0;
        const startDate = gvizDateToIso(row.c?.[4]?.v);
        const endDate = gvizDateToIso(row.c?.[5]?.v);
        if (!name || !channel || !startDate || !endDate) continue;
        if (/^\d{4}$/.test(name)) continue;
        if (channel !== channelFilter) continue;
        raw.push({ name, channel, budget, startDate, endDate });
    }
    return sanitizeAuraInput("campaigns", raw);
}

async function parseGoals(performanceSheetId) {
    const rows = await gvizRows(performanceSheetId, "Config", "A1:D25");
    const byMonth = new Map();
    for (const row of rows) {
        const month = String(row.c?.[1]?.v || "").trim().toLowerCase();
        const goal = Number(row.c?.[2]?.v);
        const budget = Number(row.c?.[3]?.v);
        if (!MONTH_ORDER.includes(month)) continue;
        if (!Number.isFinite(goal) || !Number.isFinite(budget)) continue;
        byMonth.set(month, { goal, budget });
    }
    const goals = MONTH_ORDER.map((m) => byMonth.get(m) || { goal: 0, budget: 0 });
    return sanitizeAuraInput("goals", goals);
}

function diffJson(label, key, a, b) {
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b ?? null);
    return { label, key, match: sa === sb, countA: Array.isArray(a) ? a.length : 12, countB: Array.isArray(b) ? b.length : b ? 12 : 0 };
}

export async function runAuraInputImport() {
    const conversionsCsv = KEYS.has("conversions") ? await fetchConversionsCsv() : null;
    if (conversionsCsv) console.log(`Conversions tab: ${conversionsCsv.length} lines (${DATA_SHEET_ID})`);

    await mongoose.connect(process.env.MONGODB_URI, { dbName: "apex-v2" });

    for (const [name, cfg] of Object.entries(CUSTOMERS)) {
        console.log(`\n— ${name} (${cfg.id}) —`);

        if (KEYS.has("conversions") && conversionsCsv) {
            const data = parseConversions(conversionsCsv, { convCol: cfg.convCol, breakdown: cfg.breakdown });
            const existing = await CustomDashboardInput.findOne({ customer: cfg.id, dashboard: "aura", key: "conversions" }).lean();
            const mismatches = diffJson(name, "conversions", data, existing?.data);
            console.log("  conversions:", mismatches.countA, "rows", mismatches.match ? "OK" : "CHANGED");
            if (!dryRun) {
                await CustomDashboardInput.findOneAndUpdate(
                    { customer: cfg.id, dashboard: "aura", key: "conversions" },
                    { $set: { data, updatedBy: "aura-import-aura-inputs-from-sheet" } },
                    { upsert: true }
                );
            }
        }

        if (KEYS.has("campaigns")) {
            const data = await parseCampaigns(cfg.campaignChannel);
            const existing = await CustomDashboardInput.findOne({ customer: cfg.id, dashboard: "aura", key: "campaigns" }).lean();
            const match = diffJson(name, "campaigns", data, existing?.data);
            console.log(`  campaigns (${cfg.campaignChannel}):`, match.countA, "rows", match.match ? "OK" : "CHANGED");
            if (!dryRun) {
                await CustomDashboardInput.findOneAndUpdate(
                    { customer: cfg.id, dashboard: "aura", key: "campaigns" },
                    { $set: { data, updatedBy: "aura-import-aura-inputs-from-sheet" } },
                    { upsert: true }
                );
            }
        }

        if (KEYS.has("goals")) {
            const perfId = PERFORMANCE_SHEET_IDS[name];
            // sanitize wraps legacy flat months under year 2026
            const data = await parseGoals(perfId);
            const existing = await CustomDashboardInput.findOne({ customer: cfg.id, dashboard: "aura", key: "goals" }).lean();
            const jan = data?.["2026"]?.[0] || data?.[0] || { goal: 0, budget: 0 };
            const match = diffJson(name, "goals", data, existing?.data);
            console.log(`  goals (sheet ${perfId.slice(0, 8)}…): jan goal=${jan.goal} budget=${jan.budget}`, match.match ? "OK" : "CHANGED");
            if (!dryRun) {
                await CustomDashboardInput.findOneAndUpdate(
                    { customer: cfg.id, dashboard: "aura", key: "goals" },
                    { $set: { data, updatedBy: "aura-import-aura-inputs-from-sheet" } },
                    { upsert: true }
                );
            }
        }
    }

    await mongoose.disconnect();
    console.log("\nDone.", dryRun ? "(dry run)" : "");
}

import { fileURLToPath } from "url";

const isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    runAuraInputImport().catch((e) => {
        console.error(e);
        process.exit(1);
    });
}