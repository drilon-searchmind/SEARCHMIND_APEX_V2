/**
 * Parse Ahrefs API "column not found" errors and remap select / order_by.
 */

/** Common Ahrefs column renames across Site Explorer endpoints. */
const COLUMN_ALIASES = {
    volume: "top_keyword_volume",
    keyword_volume: "top_keyword_volume",
};

/**
 * @param {string} message
 * @returns {string[]|null}
 */
export function parseAhrefsAvailableColumns(message) {
    const text = String(message || "");
    const m = text.match(/Available columns:\s*([^\n]+)/i);
    if (!m) return null;
    return m[1]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
}

/**
 * @param {string} select — comma-separated column list
 * @param {string[]} available
 */
export function remapAhrefsSelect(select, available) {
    const availableSet = new Set(available);
    const parts = String(select || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

    const mapped = [];
    for (const col of parts) {
        if (availableSet.has(col)) {
            mapped.push(col);
            continue;
        }
        const alias = COLUMN_ALIASES[col];
        if (alias && availableSet.has(alias)) {
            mapped.push(alias);
        }
    }

    if (mapped.length === 0) return null;
    return mapped.join(",");
}

/**
 * @param {string} orderBy — e.g. volume:desc
 * @param {string} select — final select string after remap
 */
export function remapAhrefsOrderBy(orderBy, select) {
    if (!orderBy) return orderBy;
    const selectCols = new Set(
        String(select || "")
            .split(",")
            .map((c) => c.trim())
    );
    const [col, dir] = String(orderBy).split(":");
    const trimmed = col?.trim();
    if (!trimmed) return orderBy;
    if (selectCols.has(trimmed)) return orderBy;
    const alias = COLUMN_ALIASES[trimmed];
    if (alias && selectCols.has(alias)) {
        return `${alias}:${dir || "desc"}`;
    }
    if (selectCols.has("sum_traffic")) return `sum_traffic:${dir || "desc"}`;
    return orderBy;
}

/**
 * Build alternate select attempts after an error (programmatic, no AI).
 * @param {string} select
 * @param {string} [orderBy]
 * @param {string} message
 * @returns {{ select: string, order_by?: string }[]}
 */
export function buildAhrefsSelectAttemptsFromError(select, orderBy, message) {
    const available = parseAhrefsAvailableColumns(message);
    if (!available) return [];

    const remapped = remapAhrefsSelect(select, available);
    if (!remapped || remapped === select) return [];

    const attempts = [{ select: remapped }];
    if (orderBy) {
        attempts[0].order_by = remapAhrefsOrderBy(orderBy, remapped);
    }
    return attempts;
}

/**
 * Programmatic repairs for known subsection failures (before Claude).
 * @param {{ section?: string, message?: string }[]} errors
 */
export function programmaticAhrefsRepairsFromErrors(errors) {
    /** @type {Record<string, { select: string, order_by?: string }>} */
    const repairs = {};

    for (const e of errors || []) {
        const section = e?.section;
        const msg = e?.message || "";
        if (!section) continue;

        if (section === "top_pages" && /volume/i.test(msg)) {
            repairs.top_pages = {
                select: "url,sum_traffic,referring_domains,top_keyword,top_keyword_volume",
                order_by: "sum_traffic:desc",
            };
        }

        const available = parseAhrefsAvailableColumns(msg);
        if (available && section === "top_pages" && !repairs.top_pages) {
            const remapped = remapAhrefsSelect(
                "url,sum_traffic,referring_domains,top_keyword,volume",
                available
            );
            if (remapped) {
                repairs.top_pages = {
                    select: remapped,
                    order_by: remapAhrefsOrderBy("sum_traffic:desc", remapped),
                };
            }
        }

        if (section === "organic_keywords" && /volume/i.test(msg)) {
            const availableKw = parseAhrefsAvailableColumns(msg);
            if (availableKw) {
                const remapped = remapAhrefsSelect(
                    "keyword,volume,best_position,sum_traffic",
                    availableKw
                );
                if (remapped) {
                    repairs.organic_keywords = {
                        select: remapped,
                        order_by: remapAhrefsOrderBy("volume:desc", remapped),
                    };
                }
            }
        }
    }

    return repairs;
}
