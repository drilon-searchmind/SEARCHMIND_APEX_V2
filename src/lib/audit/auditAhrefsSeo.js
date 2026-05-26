import {
    ahrefsGet,
    ahrefsGetWithSelectAttempts,
    ahrefsCountryFromTarget,
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
- If a subsection failed (see ahrefs.errors), mention only that subsection in data_gaps — do not claim Ahrefs is missing when other Ahrefs sections loaded successfully.`;

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
 * @param {Record<string, string|number|undefined>} base — target, date, mode, protocol, country
 * @param {string|undefined} dateCompared
 */
async function fetchOrganicKeywordsForAudit(base, dateCompared, repairHint) {
    const selectCore =
        "keyword,volume,best_position,sum_traffic,best_position_url,keyword_difficulty,is_transactional,is_commercial";
    const selectWithDiff = dateCompared ? `${selectCore},best_position_diff` : selectCore;

    /** @type {Array<{ select: string, order_by: string, date_compared?: string }>} */
    const attempts = [];
    if (repairHint?.select) {
        attempts.push({
            select: repairHint.select,
            order_by: repairHint.order_by || "volume:desc",
            date_compared: dateCompared,
        });
    }
    attempts.push(
        { select: selectWithDiff, order_by: "volume:desc", date_compared: dateCompared },
        { select: selectCore, order_by: "volume:desc" },
        { select: "keyword,volume,best_position,sum_traffic", order_by: "volume:desc" }
    );

    return ahrefsGetWithSelectAttempts(
        "/site-explorer/organic-keywords",
        { ...base, limit: 100 },
        attempts.filter((a) => a.date_compared || !a.select.includes("best_position_diff"))
    );
}

/**
 * @param {{
 *   googleSearchConsoleProperty: string,
 *   startDate: string,
 *   endDate: string,
 *   comparisonDateRange?: { startDate: string, endDate: string }|null,
 *   repairHints?: Record<string, { select: string, order_by?: string }>,
 * }} opts
 */
export async function fetchAhrefsAuditBundle(opts) {
    const repairHints = opts.repairHints || {};
    const target = ahrefsTargetFromGscProperty(opts.googleSearchConsoleProperty);
    if (!target) {
        return { included: false, reason: "Could not derive Ahrefs target from Google Search Console property" };
    }

    const date = ahrefsReportDate(opts.endDate);
    const dateCompared = opts.comparisonDateRange?.endDate
        ? ahrefsReportDate(opts.comparisonDateRange.endDate)
        : undefined;
    const country = ahrefsCountryFromTarget(target);

    const base = {
        target,
        date,
        mode: "subdomains",
        protocol: "both",
        country,
    };

    const errors = [];
    /** @type {Record<string, unknown>} */
    const out = {
        included: true,
        target,
        country,
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
        const kw = await fetchOrganicKeywordsForAudit(
            base,
            dateCompared,
            repairHints.organic_keywords
        );
        out.organicKeywords = trimAhrefsRows(kw, 100);
    } catch (e) {
        errors.push({ section: "organic_keywords", message: e?.message || String(e) });
    }

    try {
        const topPagesAttempts = [];
        if (repairHints.top_pages?.select) {
            topPagesAttempts.push({
                select: repairHints.top_pages.select,
                order_by: repairHints.top_pages.order_by || "sum_traffic:desc",
            });
        }
        topPagesAttempts.push(
            {
                select: "url,sum_traffic,referring_domains,top_keyword,top_keyword_volume",
                order_by: "sum_traffic:desc",
            },
            {
                select: "url,sum_traffic,referring_domains,top_keyword",
                order_by: "sum_traffic:desc",
            }
        );
        const pages = await ahrefsGetWithSelectAttempts(
            "/site-explorer/top-pages",
            { ...base, limit: 40 },
            topPagesAttempts
        );
        out.topPages = trimAhrefsRows(pages, 40);
    } catch (e) {
        errors.push({ section: "top_pages", message: e?.message || String(e) });
    }

    try {
        const links = await ahrefsGet("/site-explorer/all-backlinks", {
            target,
            mode: "subdomains",
            protocol: "both",
            select: "url_from,domain_rating_source,anchor,is_dofollow,first_seen,traffic",
            limit: 25,
            order_by: "domain_rating_source:desc",
            history: "live",
        });
        out.backlinkSample = trimAhrefsRows(links, 25);
    } catch (e) {
        errors.push({ section: "backlinks", message: e?.message || String(e) });
    }

    return out;
}
