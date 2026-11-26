/**
 * Import Aura 2027 monthly goals from the attached budget CSV.
 * Does NOT modify 2026 goals, filters, conversions, or campaigns.
 *
 *   node scripts/aura-import-goals-2027-from-csv.mjs
 *   node scripts/aura-import-goals-2027-from-csv.mjs --dry-run
 *   node scripts/aura-import-goals-2027-from-csv.mjs --csv=path/to/file.csv
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import CustomDashboardInput from "../src/models/CustomDashboardInput.js";
import { normalizeGoalsByYear, normalizeMonthGoals } from "../src/lib/auraInputs.js";

const dryRun = process.argv.includes("--dry-run");
const csvArg = process.argv.find((a) => a.startsWith("--csv="));
const DEFAULT_CSV = path.resolve(
    process.env.USERPROFILE || process.env.HOME || "",
    ".cursor/projects/c-Users-Drili-DEV-SEARCHMIND-SEARCHMIND-APEX-V2/attachments/5f39be68-ae70-4eee-a2ea-fab892e6f8cd/aura_alle_budget_maal_2026_2027_1.csv"
);
const csvPath = csvArg ? path.resolve(csvArg.slice("--csv=".length)) : DEFAULT_CSV;

const EXPECTED_CUSTOMERS = {
    "6afebf0ba91ce3d863daee7f": "Aura - EL",
    "6a2beefcbe106fcd31646dcb": "Aura - EMOB",
    "6afebf0ba91ce3d863daee92": "Aura - Fiber",
};

function parseSemicolonCsv(text) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("CSV is empty");
    const headers = lines[0].split(";").map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const cols = line.split(";");
        /** @type {Record<string, string>} */
        const row = {};
        headers.forEach((h, i) => {
            row[h] = (cols[i] ?? "").trim();
        });
        return row;
    });
}

/** @param {Record<string, string>[]} rows */
function build2027ByCustomer(rows) {
    /** @type {Map<string, { name: string, months: { goal: number, budget: number }[] }>} */
    const map = new Map();
    for (const row of rows) {
        if (String(row.year) !== "2027") continue;
        const id = String(row.customer_id || "").trim();
        const month = Number(row.month);
        if (!id || !Number.isInteger(month) || month < 1 || month > 12) continue;
        if (!map.has(id)) {
            map.set(id, {
                name: String(row.dashboard || EXPECTED_CUSTOMERS[id] || id),
                months: normalizeMonthGoals([]),
            });
        }
        const entry = map.get(id);
        entry.months[month - 1] = {
            goal: Number(row.goal_customers) || 0,
            budget: Number(row.budget_dkk) || 0,
        };
    }
    return map;
}

async function main() {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
    if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

    const rows = parseSemicolonCsv(fs.readFileSync(csvPath, "utf8"));
    const byCustomer = build2027ByCustomer(rows);
    if (byCustomer.size === 0) throw new Error("No 2027 rows found in CSV");

    console.log(`CSV: ${csvPath}`);
    console.log(`Customers with 2027 rows: ${byCustomer.size}${dryRun ? " (dry-run)" : ""}`);

    await mongoose.connect(process.env.MONGODB_URI, { dbName: "apex-v2" });

    for (const [customerId, payload] of byCustomer) {
        const existing = await CustomDashboardInput.findOne({
            customer: customerId,
            dashboard: "aura",
            key: "goals",
        }).lean();

        const before = existing?.data;
        const wasFlat = Array.isArray(before);
        const next = normalizeGoalsByYear(before);
        // Preserve whatever 2026 (and other years) already are; only set 2027.
        const prev2026 = JSON.stringify(next["2026"] || null);
        next["2027"] = payload.months;
        const after2026 = JSON.stringify(next["2026"] || null);

        if (prev2026 !== after2026) {
            throw new Error(`${payload.name}: refused — 2026 would change`);
        }

        const jan = payload.months[0];
        console.log(
            `\n— ${payload.name} (${customerId}) —` +
                `\n  existing shape: ${wasFlat ? "flat→migrate under 2026" : "year-keyed"}` +
                `\n  years kept: ${Object.keys(next)
                    .filter((y) => y !== "2027")
                    .sort()
                    .join(", ") || "(none)"}` +
                `\n  2027 jan: goal=${jan.goal} budget=${jan.budget}`
        );

        if (!dryRun) {
            await CustomDashboardInput.findOneAndUpdate(
                { customer: customerId, dashboard: "aura", key: "goals" },
                {
                    $set: {
                        data: next,
                        updatedBy: "aura-import-goals-2027-from-csv",
                    },
                },
                { upsert: true }
            );
            console.log("  saved 2027 (2026/filter untouched)");
        } else {
            console.log("  dry-run — not saved");
        }
    }

    // Sanity: never touch filter docs
    const filterCount = await CustomDashboardInput.countDocuments({
        dashboard: "aura",
        key: "filter",
        customer: { $in: [...byCustomer.keys()] },
    });
    console.log(`\nFilter docs present (unchanged): ${filterCount}`);

    await mongoose.disconnect();
    console.log("\nDone.", dryRun ? "(dry run)" : "");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
