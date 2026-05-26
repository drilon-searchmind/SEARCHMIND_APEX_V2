import { isAhrefsConfigured } from "@/lib/ahrefsApi";

/** @typedef {'data_fetch'|'analysis'|'config'|'integration'} AuditDiagnosticCategory */

/** @typedef {{ category: AuditDiagnosticCategory, source: string, message: string, detail?: unknown }} AuditDiagnosticItem */

const INTEGRATION_WARNING_MESSAGES = {
    seo: "Google Search Console property is not configured",
    ppc: "Google Ads customer ID is not configured",
    ps: "Meta ad account is not configured",
    pinterest: "Pinterest ad account or auth is not configured",
    snapchat: "Snapchat ad account or auth is not configured",
    reddit: "Reddit ad account or auth is not configured",
    bing: "Microsoft Ads account is not configured",
    em: "Klaviyo is not configured",
};

/**
 * @param {AuditDiagnosticCategory} category
 * @param {string} source
 * @param {string} message
 * @param {unknown} [detail]
 * @returns {AuditDiagnosticItem}
 */
function item(category, source, message, detail) {
    const row = {
        category,
        source: String(source || "unknown"),
        message: String(message || "").trim() || "(no message)",
    };
    if (detail !== undefined && detail !== null) {
        row.detail = detail;
    }
    return row;
}

/**
 * @param {unknown} block
 * @param {string} source
 * @param {AuditDiagnosticItem[]} items
 */
function collectSkippedEnrichment(block, source, items) {
    if (!block || typeof block !== "object") return;
    const b = /** @type {Record<string, unknown>} */ (block);
    if (b.included === false) {
        const msg = b.reason || b.error || "Data source was not included";
        items.push(item("data_fetch", source, String(msg), b));
    }
}

/**
 * @param {unknown} auditContext
 * @param {{
 *   failedAnalyses?: Array<{ id?: string, title?: string, error?: string }>,
 *   integrationWarnings?: Record<string, boolean>,
 *   aiConfigured?: boolean,
 * }} [opts]
 */
export function buildAuditDeveloperDiagnostics(auditContext, opts = {}) {
    /** @type {AuditDiagnosticItem[]} */
    const items = [];
    const se =
        auditContext?.serverEnrichment && typeof auditContext.serverEnrichment === "object"
            ? auditContext.serverEnrichment
            : null;

    if (se) {
        for (const e of Array.isArray(se.errors) ? se.errors : []) {
            if (!e || typeof e !== "object") continue;
            const row = /** @type {{ source?: string, message?: string }} */ (e);
            items.push(
                item("data_fetch", row.source || "server", row.message || "Fetch error")
            );
        }

        const ahrefs = se.ahrefs;
        if (ahrefs && typeof ahrefs === "object") {
            const a = /** @type {Record<string, unknown>} */ (ahrefs);
            if (a.error) {
                items.push(item("data_fetch", "ahrefs", String(a.error), a));
            }
            for (const e of Array.isArray(a.errors) ? a.errors : []) {
                if (!e || typeof e !== "object") continue;
                const row = /** @type {{ section?: string, message?: string }} */ (e);
                items.push(
                    item(
                        "data_fetch",
                        row.section ? `ahrefs.${row.section}` : "ahrefs",
                        row.message || "Ahrefs subsection failed"
                    )
                );
            }
            collectSkippedEnrichment(ahrefs, "ahrefs", items);
        }

        for (const key of [
            "searchConsole",
            "searchConsoleComparison",
            "googleAds",
            "meta",
            "klaviyo",
            "shopify",
            "adSpend",
        ]) {
            collectSkippedEnrichment(se[key], key, items);
        }
    }

    const warnings = opts.integrationWarnings || {};
    for (const [key, missing] of Object.entries(warnings)) {
        if (!missing) continue;
        items.push(
            item(
                "config",
                key,
                INTEGRATION_WARNING_MESSAGES[key] ||
                    `${key} integration is not fully configured`
            )
        );
    }

    if (Array.isArray(se?.sources) && se.sources.includes("ahrefs") && !isAhrefsConfigured()) {
        items.push(
            item("config", "ahrefs", "AHREFS_API_KEY is not set in server environment")
        );
    }

    if (opts.aiConfigured === false) {
        items.push(
            item(
                "config",
                "claude",
                "CLAUDE_CODE_API_KEY / ANTHROPIC_API_KEY is not configured — AI analyses were not run"
            )
        );
    }

    for (const f of opts.failedAnalyses || []) {
        items.push(
            item(
                "analysis",
                f.title || f.id || "analysis",
                f.error || "Analysis failed",
                f
            )
        );
    }

    const byCategory = {
        data_fetch: items.filter((i) => i.category === "data_fetch").length,
        analysis: items.filter((i) => i.category === "analysis").length,
        config: items.filter((i) => i.category === "config").length,
        integration: items.filter((i) => i.category === "integration").length,
    };

    return {
        collectedAt: se?.fetchedAt || new Date().toISOString(),
        itemCount: items.length,
        byCategory,
        items,
    };
}
