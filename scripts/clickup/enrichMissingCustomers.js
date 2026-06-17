/**
 * Enrich missing ClickUp customers with website intelligence via Context.dev.
 *
 * Reads scripts/clickup/missing_customers.csv and writes an expanded CSV with
 * suggested APEX Customer model fields (platform, business category, GA tags, etc.).
 *
 * Prerequisites: `.env` with CONTEXT_DEV_API_KEY or CONTEXT_API_KEY
 * Sign up: https://context.dev/signup
 *
 * Credit usage per customer (default --mode=standard):
 *   HTML scrape (1) + structured extract (10) ≈ 11 credits
 * Optional brand lookup (--with-brand): +10 credits
 *
 * Usage:
 *   node scripts/clickup/enrichMissingCustomers.js
 *   node scripts/clickup/enrichMissingCustomers.js --limit=5
 *   node scripts/clickup/enrichMissingCustomers.js --resume
 *   node scripts/clickup/enrichMissingCustomers.js --mode=html-only
 *   node scripts/clickup/enrichMissingCustomers.js --output=scripts/clickup/missing_customers.csv
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readCsvRecords, rowsToCsv } from "./csvUtils.js";
import {
    scrapeHtml,
    retrieveBrand,
    extractStructuredData,
    APEX_ENRICHMENT_SCHEMA,
    APEX_ENRICHMENT_INSTRUCTIONS,
    getContextDevApiKey,
} from "./contextDevClient.js";
import {
    domainToWebsiteUrl,
    mergeEnrichment,
    emptyEnrichmentRow,
    normalizeDomain,
} from "./websiteEnrichment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = path.join(__dirname, "missing_customers.csv");
const DEFAULT_OUTPUT = path.join(__dirname, "missing_customers_enriched.csv");

const OUTPUT_HEADERS = [
    "clickup_id",
    "clickup_name",
    "website_url",
    "suggested_customer_name",
    "business_category",
    "customer_type",
    "shopify_url",
    "woo_commerce_api_url",
    "magento_base_url",
    "dan_domain_shop_host",
    "ga4_property_id",
    "ga4_measurement_id",
    "google_tag_manager_id",
    "google_search_console_property",
    "bing_webmaster_site_url",
    "customer_store_valuta_code",
    "company_description",
    "industry",
    "sells_products_online",
    "sells_to_businesses_only",
    "platform_signals",
    "enrichment_confidence",
    "enrichment_notes",
    "context_urls_analyzed",
    "enrichment_status",
    "enrichment_error",
    "enriched_at",
];

function parseArgs() {
    const opts = {
        input: DEFAULT_INPUT,
        output: DEFAULT_OUTPUT,
        limit: Infinity,
        resume: false,
        delayMs: 1500,
        mode: "standard",
        withBrand: false,
        dryRun: false,
    };

    for (const arg of process.argv.slice(2)) {
        if (arg === "--resume") opts.resume = true;
        else if (arg === "--with-brand") opts.withBrand = true;
        else if (arg === "--dry-run") opts.dryRun = true;
        else if (arg.startsWith("--input=")) opts.input = path.resolve(arg.slice("--input=".length));
        else if (arg.startsWith("--output=")) opts.output = path.resolve(arg.slice("--output=".length));
        else if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice("--limit=".length));
        else if (arg.startsWith("--delay=")) opts.delayMs = Number(arg.slice("--delay=".length));
        else if (arg.startsWith("--mode=")) opts.mode = arg.slice("--mode=".length);
    }

    return opts;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function loadExistingOutput(outputPath) {
    if (!fs.existsSync(outputPath)) return new Map();
    const { records } = readCsvRecords(outputPath, fs);
    const map = new Map();
    for (const row of records) {
        if (row.clickup_id) map.set(row.clickup_id, row);
    }
    return map;
}

function writeOutput(outputPath, records) {
    const sorted = [...records].sort((a, b) =>
        (a.clickup_name || "").localeCompare(b.clickup_name || "", "da")
    );
    fs.writeFileSync(outputPath, rowsToCsv(OUTPUT_HEADERS, sorted), "utf-8");
}

async function withRetry(fn, { maxAttempts = 4 } = {}) {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (err.code === "RATE_LIMITED" && attempt < maxAttempts) {
                const waitSec = err.retryAfterSec || 10;
                console.warn(`  Rate limited — waiting ${waitSec}s...`);
                await sleep(waitSec * 1000);
                continue;
            }
            if (attempt < maxAttempts && (err.status >= 500 || err.name === "AbortError")) {
                await sleep(2000 * attempt);
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

async function enrichOneCustomer(row, opts) {
    const clickupId = row.clickup_id || row.clickupId || "";
    const clickupName = row.clickup_name || row.clickupName || "";
    const websiteUrl = domainToWebsiteUrl(clickupName);

    if (!websiteUrl) {
        return emptyEnrichmentRow({
            clickupId,
            clickupName,
            websiteUrl: "",
            status: "error",
            error: "Could not derive website URL from clickup_name",
        });
    }

    let htmlResult = null;
    let brandResult = null;
    let extractResult = null;

    if (opts.mode !== "extract-only") {
        try {
            htmlResult = await withRetry(() =>
                scrapeHtml(websiteUrl, { timeoutMS: 90000 })
            );
        } catch (err) {
            console.warn(`  HTML scrape skipped: ${err.message}`);
        }
    }

    if (opts.withBrand) {
        try {
            const domain = normalizeDomain(clickupName);
            brandResult = await withRetry(() =>
                retrieveBrand(domain, { timeoutMS: 90000 })
            );
        } catch (err) {
            console.warn(`  Brand lookup skipped: ${err.message}`);
        }
    }

    if (opts.mode !== "html-only") {
        try {
            extractResult = await withRetry(() =>
                extractStructuredData(websiteUrl, {
                    schema: APEX_ENRICHMENT_SCHEMA,
                    instructions: APEX_ENRICHMENT_INSTRUCTIONS,
                    maxPages: 5,
                    timeoutMS: 120000,
                })
            );
        } catch (err) {
            if (!htmlResult?.html) throw err;
            console.warn(`  Extract skipped: ${err.message}`);
        }
    }

    if (!htmlResult?.html && !extractResult?.data) {
        throw new Error("Both HTML scrape and structured extract failed");
    }

    return mergeEnrichment({
        clickupId,
        clickupName,
        websiteUrl,
        htmlResult,
        brandResult,
        extractResult,
    });
}

async function main() {
    const opts = parseArgs();

    try {
        getContextDevApiKey();
    } catch (err) {
        console.error(err.message);
        console.error("Add your key from https://context.dev/signup to .env as CONTEXT_API_KEY");
        process.exit(1);
    }

    if (!fs.existsSync(opts.input)) {
        console.error(`Input not found: ${opts.input}`);
        console.error("Run: npm run clickup:compare-customers");
        process.exit(1);
    }

    const { records: inputRows } = readCsvRecords(opts.input, fs);
    const normalizedInput = inputRows.map((row) => ({
        clickup_id: row.clickup_id || row.clickupId || "",
        clickup_name: row.clickup_name || row.clickupName || "",
    }));

    const existingById = opts.resume ? loadExistingOutput(opts.output) : new Map();
    const results = new Map(existingById);

    let processed = 0;
    let skipped = 0;

    console.log(`Input: ${opts.input} (${normalizedInput.length} rows)`);
    console.log(`Output: ${opts.output}`);
    console.log(`Mode: ${opts.mode}${opts.withBrand ? " + brand" : ""}`);
    if (Number.isFinite(opts.limit)) console.log(`Limit: ${opts.limit}`);
    if (opts.resume) console.log(`Resume: skipping ${existingById.size} already in output`);
    console.log("");

    for (const row of normalizedInput) {
        if (processed >= opts.limit) break;

        const id = row.clickup_id;
        if (!id) continue;

        if (opts.resume) {
            const prev = existingById.get(id);
            if (prev?.enrichment_status === "ok") {
                skipped++;
                continue;
            }
        }

        processed++;
        console.log(`[${processed}] ${row.clickup_name} (${id})`);

        if (opts.dryRun) {
            console.log(`  → would enrich ${domainToWebsiteUrl(row.clickup_name)}`);
            continue;
        }

        try {
            const enriched = await enrichOneCustomer(row, opts);
            results.set(id, enriched);
            writeOutput(opts.output, Array.from(results.values()));

            console.log(
                `  ✓ ${enriched.business_category || "?"} / ${enriched.customer_type || "?"} / confidence: ${enriched.enrichment_confidence}`
            );
            if (enriched.ga4_measurement_id) {
                console.log(`    GA4 measurement: ${enriched.ga4_measurement_id} (not property ID)`);
            }
            if (enriched.platform_signals) {
                console.log(`    signals: ${enriched.platform_signals}`);
            }
        } catch (err) {
            const failed = emptyEnrichmentRow({
                clickupId: id,
                clickupName: row.clickup_name,
                websiteUrl: domainToWebsiteUrl(row.clickup_name),
                status: "error",
                error: err.message || String(err),
            });
            results.set(id, failed);
            writeOutput(opts.output, Array.from(results.values()));
            console.error(`  ✗ ${failed.enrichment_error}`);
        }

        if (processed < opts.limit) {
            await sleep(opts.delayMs);
        }
    }

    console.log("\n=== DONE ===");
    console.log(`Processed: ${processed}`);
    console.log(`Skipped (resume): ${skipped}`);
    console.log(`Total rows in output: ${results.size}`);
    console.log(`Written to: ${opts.output}`);
    console.log("\nNote: ga4_property_id is rarely public on websites.");
    console.log("ga4_measurement_id (G-xxx) is NOT the same as GA4 property ID in APEX.");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
