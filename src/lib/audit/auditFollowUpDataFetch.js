import { getCustomerById } from "@root/lib/customerOperations";
import { buildAuditContext } from "./auditContextBuilder";

const MAX_EPHEMERAL_JSON_CHARS = 100_000;

/**
 * @param {string[]} sources
 * @returns {string[]}
 */
export function resolveAuditGroupsFromFetchSources(sources) {
    const raw = Array.isArray(sources) ? sources.map((s) => String(s).toLowerCase()) : [];
    if (raw.length === 0 || raw.includes("all")) {
        return ["cross", "seo", "ppc", "ps", "em"];
    }

    const groups = new Set();
    if (raw.includes("shopify") || raw.includes("merged")) groups.add("cross");
    if (raw.includes("search_console") || raw.includes("ahrefs")) groups.add("seo");
    if (raw.includes("google_ads")) groups.add("ppc");
    if (raw.includes("meta")) groups.add("ps");
    if (raw.includes("klaviyo")) groups.add("em");
    return groups.size > 0 ? [...groups] : ["cross"];
}

/**
 * @param {string[]} groups
 */
function selectionsForGroups(groups) {
    return groups.map((groupId) => ({
        groupId,
        customPrompt: "Follow-up chat: load channel data for analyst questions (read-only).",
    }));
}

/**
 * @param {unknown} value
 * @param {number} maxChars
 */
export function truncateForEphemeralContext(value, maxChars = MAX_EPHEMERAL_JSON_CHARS) {
    let json;
    try {
        json = JSON.stringify(value);
    } catch {
        return { _error: "Could not serialize fetched data" };
    }
    if (json.length <= maxChars) {
        return value;
    }
    return {
        _truncated: true,
        _originalBytes: json.length,
        _note: `Payload truncated to ~${maxChars} characters for chat context.`,
        preview: json.slice(0, maxChars),
    };
}

/**
 * @param {unknown} existing
 * @param {unknown} incoming
 */
export function mergeEphemeralDataContext(existing, incoming) {
    const prev =
        existing && typeof existing === "object" ? /** @type {Record<string, unknown>} */ (existing) : {};
    const next =
        incoming && typeof incoming === "object" ? /** @type {Record<string, unknown>} */ (incoming) : {};

    const merged = {
        ...prev,
        ...next,
        fetchedAt: next.fetchedAt || prev.fetchedAt,
        fetches: [
            ...(Array.isArray(prev.fetches) ? prev.fetches : []),
            ...(Array.isArray(next.fetches) ? next.fetches : []),
        ],
    };

    if (next.serverEnrichment || prev.serverEnrichment) {
        merged.serverEnrichment = {
            ...(prev.serverEnrichment && typeof prev.serverEnrichment === "object"
                ? prev.serverEnrichment
                : {}),
            ...(next.serverEnrichment && typeof next.serverEnrichment === "object"
                ? next.serverEnrichment
                : {}),
        };
    }

    return truncateForEphemeralContext(merged);
}

/**
 * @param {{
 *   customerId: string,
 *   startDate: string,
 *   endDate: string,
 *   comparisonDateRange?: { startDate: string, endDate: string } | null,
 *   sources?: string[],
 *   reason?: string,
 * }} opts
 */
export async function fetchAuditFollowUpData(opts) {
    const customer = await getCustomerById(opts.customerId);
    const plain = typeof customer.toObject === "function" ? customer.toObject() : customer;
    const groups = resolveAuditGroupsFromFetchSources(opts.sources);
    const selections = selectionsForGroups(groups);

    const auditContext = await buildAuditContext({
        customer: plain,
        customerId: String(opts.customerId),
        startDate: opts.startDate,
        endDate: opts.endDate,
        comparisonDateRange: opts.comparisonDateRange || null,
        selections,
        pageSnapshot: {},
    });

    const se = auditContext.serverEnrichment || {};
    const errors = Array.isArray(se.errors) ? se.errors : [];
    const ahrefsErrors =
        se.ahrefs && typeof se.ahrefs === "object" && Array.isArray(se.ahrefs.errors)
            ? se.ahrefs.errors
            : [];

    const loaded = [];
    if (se.shopify) loaded.push("shopify");
    if (se.adSpend) loaded.push("ad_spend");
    if (se.searchConsole) loaded.push("search_console");
    if (se.searchConsoleComparison) loaded.push("search_console_comparison");
    if (se.ahrefs) loaded.push("ahrefs");
    if (se.googleAds) loaded.push("google_ads");
    if (se.meta) loaded.push("meta");
    if (se.klaviyo) loaded.push("klaviyo");

    const summaryParts = [
        `Loaded ${loaded.length ? loaded.join(", ") : "no"} source(s) for ${opts.startDate} → ${opts.endDate}.`,
    ];
    if (errors.length) {
        summaryParts.push(`${errors.length} fetch warning(s).`);
    }
    if (ahrefsErrors.length) {
        summaryParts.push(`Ahrefs: ${ahrefsErrors.length} subsection issue(s).`);
    }

    return {
        ok: true,
        groups,
        sourcesRequested: opts.sources || ["all"],
        reason: opts.reason || "",
        summary: summaryParts.join(" "),
        payload: {
            fetchedAt: new Date().toISOString(),
            groups,
            serverEnrichment: se,
            fetches: [
                {
                    at: new Date().toISOString(),
                    sources: opts.sources || ["all"],
                    reason: opts.reason || "",
                    loaded,
                },
            ],
        },
        toolResult: {
            ok: true,
            summary: summaryParts.join(" "),
            groups,
            loaded,
            errors: [...errors, ...ahrefsErrors.map((e) => ({ source: `ahrefs.${e.section}`, message: e.message }))],
            serverEnrichment: se,
        },
    };
}
