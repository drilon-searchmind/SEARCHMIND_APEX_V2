import {
    ahrefsGet,
    ahrefsReportDate,
    ahrefsTargetFromGscProperty,
    isAhrefsConfigured,
    trimAhrefsRows,
} from "@/lib/ahrefsApi";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { auditGroupIdFromCardId } from "./auditPromptCatalog";

/**
 * Hardcoded analyst instruction — always appended to audit user messages when Ahrefs data is loaded.
 * Not stored in the admin prompt library so SEO/cross analyses always reference Ahrefs consistently.
 */
export const AUDIT_AHREFS_ANALYST_INSTRUCTION = `AHREFS DATA (included in serverEnrichment.ahrefs when present):
- Use organic keyword rows for volume estimates, ranking positions, traffic potential, and striking-distance opportunities.
- Cross-reference Ahrefs keywords with searchConsole.queries and serverEnrichment.shopify where relevant.
- Use topPages and backlink samples for backlink gap analysis and page-level priorities.
- Use domainRating as site authority context; do not invent competitor DR unless competitor data is provided.
- If ahrefs.errors is non-empty or a subsection is missing, list it in data_gaps — do not fabricate Ahrefs metrics.`;

/**
 * @param {unknown[]} selections — normalized audit selections
 * @param {Record<string, unknown>} settings — CustomerSettings
 */
export function shouldFetchAhrefsForAudit(selections, settings) {
    if (!isAhrefsConfigured()) return false;
    if (!isValidIntegrationId(settings?.googleSearchConsoleProperty)) return false;

    const groups = new Set();
    for (const sel of selections || []) {
        if (!sel || typeof sel !== "object") continue;
        const g =
            sel.groupId ||
            (sel.cardId ? auditGroupIdFromCardId(String(sel.cardId)) : "");
        if (g) groups.add(g);
    }

    return groups.has("seo") || groups.has("cross");
}

/**
 * @param {{
 *   googleSearchConsoleProperty: string,
 *   startDate: string,
 *   endDate: string,
 *   comparisonDateRange?: { startDate: string, endDate: string }|null,
 * }} opts
 */
export async function fetchAhrefsAuditBundle(opts) {
    const target = ahrefsTargetFromGscProperty(opts.googleSearchConsoleProperty);
    if (!target) {
        return { included: false, reason: "Could not derive Ahrefs target from Google Search Console property" };
    }

    const date = ahrefsReportDate(opts.endDate);
    const dateCompared = opts.comparisonDateRange?.endDate
        ? ahrefsReportDate(opts.comparisonDateRange.endDate)
        : undefined;

    const base = {
        target,
        date,
        mode: "subdomains",
        protocol: "both",
    };

    const errors = [];
    /** @type {Record<string, unknown>} */
    const out = {
        included: true,
        target,
        reportDate: date,
        reportDateCompared: dateCompared || null,
        domainRating: null,
        organicKeywords: null,
        topPages: null,
        backlinkSample: null,
        errors,
    };

    try {
        const dr = await ahrefsGet("/site-explorer/domain-rating", {
            ...base,
            select: "domain_rating,ahrefs_rank",
        });
        out.domainRating = dr;
    } catch (e) {
        errors.push({ section: "domain_rating", message: e?.message || String(e) });
    }

    try {
        const kw = await ahrefsGet("/site-explorer/organic-keywords", {
            ...base,
            select:
                "keyword,volume,best_position,sum_traffic,best_position_url,keyword_difficulty,best_position_diff,is_transactional,is_commercial",
            limit: 100,
            order_by: "volume_merged:desc",
            ...(dateCompared ? { date_compared: dateCompared } : {}),
        });
        out.organicKeywords = trimAhrefsRows(kw, 100);
    } catch (e) {
        errors.push({ section: "organic_keywords", message: e?.message || String(e) });
    }

    try {
        const pages = await ahrefsGet("/site-explorer/top-pages", {
            ...base,
            select: "url,sum_traffic,referring_domains,top_keyword,volume",
            limit: 40,
            order_by: "sum_traffic:desc",
        });
        out.topPages = trimAhrefsRows(pages, 40);
    } catch (e) {
        errors.push({ section: "top_pages", message: e?.message || String(e) });
    }

    try {
        const links = await ahrefsGet("/site-explorer/all-backlinks", {
            ...base,
            select: "url_from,domain_rating_source,anchor,is_dofollow,first_seen,traffic",
            limit: 25,
            order_by: "domain_rating_source:desc",
        });
        out.backlinkSample = trimAhrefsRows(links, 25);
    } catch (e) {
        errors.push({ section: "backlinks", message: e?.message || String(e) });
    }

    return out;
}
