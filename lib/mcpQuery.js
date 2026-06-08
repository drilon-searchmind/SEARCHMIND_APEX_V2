/**
 * @param {URLSearchParams} searchParams
 * @returns {Record<string, string>}
 */
export function searchParamsToQuery(searchParams) {
    /** @type {Record<string, string>} */
    const query = {};
    if (!searchParams) return query;
    for (const [key, value] of searchParams.entries()) {
        query[key] = value;
    }
    return query;
}

/**
 * @param {Record<string, string | undefined>} query
 * @param {string} key
 */
export function queryParam(query, key) {
    const v = query?.[key];
    return v != null && String(v).trim() !== "" ? String(v).trim() : undefined;
}
