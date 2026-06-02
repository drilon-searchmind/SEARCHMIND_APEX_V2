// src/lib/googleAdsApi.js
import { GoogleAdsApi } from 'google-ads-api';
import { normalizeGoogleAdsCampaignId } from './googleAdsCampaignIdUtils';
import {
    adCampaignFilterActive,
    normalizeCampaignNameKeywords,
    shouldExcludeAdCampaign,
} from './adCampaignFilterUtils';
import { parseGoogleAdsCustomerIds } from './googleAdsCustomerIdUtils';

export { normalizeGoogleAdsCampaignId } from './googleAdsCampaignIdUtils';

/**
 * Normalize google-ads-api / gRPC rejection objects to a short message for UI and logs.
 * @param {unknown} err
 * @returns {string}
 */
export function extractGoogleAdsClientErrorMessage(err) {
    if (err == null) return 'Google Ads request failed';
    if (typeof err === 'string') return err;
    const any = /** @type {{ message?: string; errors?: Array<{ message?: string }> }} */ (err);
    if (Array.isArray(any.errors) && any.errors[0]?.message) {
        return String(any.errors[0].message);
    }
    if (any.message) return String(any.message);
    return 'Google Ads request failed';
}

/**
 * Resolve country name or ISO code to criterion ID via geo_target_constant API (no static mapping).
 * @param {object} customer - Google Ads customer instance
 * @param {string} input - Country name (e.g. "Germany") or ISO code (e.g. "DE")
 * @returns {Promise<number|null>} Criterion ID or null
 */
export async function resolveCountryToCriterionId(customer, input) {
    const key = input.trim();
    if (!key) return null;
    const isLikelyCode = key.length === 2;
    const escape = (s) => String(s).replace(/'/g, "''");
    if (isLikelyCode) {
        const q = `SELECT geo_target_constant.id FROM geo_target_constant WHERE geo_target_constant.target_type = 'Country' AND geo_target_constant.country_code = '${escape(key.toUpperCase())}' LIMIT 1`;
        try {
            const res = await customer.query(q);
            const rows = Array.isArray(res) ? res : (res.results || []);
            return rows[0]?.geo_target_constant?.id != null ? Number(rows[0].geo_target_constant.id) : null;
        } catch (_) {
            return null;
        }
    }
    const nameVariants = [key, key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];
    for (const name of nameVariants) {
        try {
            const q = `SELECT geo_target_constant.id FROM geo_target_constant WHERE geo_target_constant.target_type = 'Country' AND geo_target_constant.name = '${escape(name)}' LIMIT 1`;
            const res = await customer.query(q);
            const rows = Array.isArray(res) ? res : (res.results || []);
            if (rows[0]?.geo_target_constant?.id != null) return Number(rows[0].geo_target_constant.id);
        } catch (_) { /* try next */ }
    }
    return null;
}

function createGoogleAdsApiCustomer(customerIdStr) {
    const client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    return client.Customer({
        customer_id: customerIdStr,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        login_customer_id: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID || undefined,
    });
}

/**
 * @param {unknown[]} metrics
 * @param {string[]} [excludedCampaignIds]
 * @param {string[]} [excludedCampaignNameKeywords]
 */
function filterMetricsByExcludedCampaigns(
    metrics,
    excludedCampaignIds,
    excludedCampaignNameKeywords
) {
    if (!Array.isArray(metrics)) return metrics;
    const ids = (excludedCampaignIds || [])
        .map((id) => normalizeGoogleAdsCampaignId(id))
        .filter(Boolean);
    const keywords = normalizeCampaignNameKeywords(excludedCampaignNameKeywords);
    if (!adCampaignFilterActive(ids.length > 0, keywords)) return metrics;

    return metrics.filter((row) => {
        const id = row?.campaign?.id ?? row?.campaign_id;
        const name = row?.campaign?.name ?? row?.campaign_name;
        return !shouldExcludeAdCampaign(
            { id, name },
            { excludedIds: ids, excludedNameKeywords: keywords },
            normalizeGoogleAdsCampaignId
        );
    });
}

/**
 * List distinct campaigns for a customer (for parent-property campaign picker).
 * @param {string} customerId
 * @param {string} startDate
 * @param {string} endDate
 * @param {{ quietLog?: boolean }} [requestOptions]
 * @returns {Promise<Array<{ id: string, name: string, status?: string }>>}
 */
async function fetchGoogleAdsCampaignListForOne(
    customerId,
    startDate,
    endDate,
    requestOptions = {}
) {
    const quietLog = requestOptions.quietLog === true;
    if (!customerId) {
        throw new Error('Google Ads customerId is missing or undefined');
    }
    const customer = createGoogleAdsApiCustomer(String(customerId));
    const q = `
        SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status != 'REMOVED'
        ORDER BY campaign.name ASC
    `;
    try {
        const res = await customer.query(q);
        const rows = Array.isArray(res) ? res : res.results || [];
        /** @type {Map<string, { id: string, name: string, status?: string }>} */
        const byId = new Map();
        for (const row of rows) {
            const id = row?.campaign?.id;
            if (id == null) continue;
            const key = normalizeGoogleAdsCampaignId(id);
            if (!key || byId.has(key)) continue;
            byId.set(key, {
                id: key,
                name: String(row.campaign?.name || key),
                status: row.campaign?.status ? String(row.campaign.status) : undefined,
            });
        }
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        if (!quietLog) console.error('Google Ads campaign list error:', err);
        throw err;
    }
}

/**
 * List distinct campaigns (supports comma-separated Google Ads customer IDs).
 * @param {string} customerId
 */
export async function fetchGoogleAdsCampaignList(
    customerId,
    startDate,
    endDate,
    requestOptions = {}
) {
    const ids = parseGoogleAdsCustomerIds(customerId);
    if (ids.length <= 1) {
        const single = ids[0] ?? String(customerId ?? "").trim();
        return fetchGoogleAdsCampaignListForOne(single, startDate, endDate, requestOptions);
    }
    const lists = await Promise.all(
        ids.map((id) =>
            fetchGoogleAdsCampaignListForOne(id, startDate, endDate, {
                ...requestOptions,
                quietLog: true,
            })
        )
    );
    /** @type {Map<string, { id: string, name: string, status?: string }>} */
    const byId = new Map();
    for (const list of lists) {
        for (const c of list) {
            if (!byId.has(c.id)) byId.set(c.id, c);
        }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches Google Ads metrics for a given customer ID and date range.
 * @param {string} customerId - Google Ads customer ID (from CustomerSettings)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} [countryFilter] - Optional comma-separated countries to INCLUDE (e.g. "Germany,Denmark,Norway")
 * @param {string} [countryExclude] - Optional comma-separated countries to EXCLUDE (e.g. "France,Spain")
 * @param {{ quietLog?: boolean, excludedCampaignIds?: string[], excludedCampaignNameKeywords?: string[], forceCampaignQuery?: boolean }} [requestOptions]
 * @returns {Promise<{metrics: object[], currencyCode: string}>} - Raw rows from Google Ads API and customer currency code
 */
async function fetchGoogleAdsMetricsForOne(
    customerId,
    startDate,
    endDate,
    countryFilter,
    countryExclude,
    requestOptions = {}
) {
        const quietLog = requestOptions.quietLog === true;
        const excludedCampaignIds = Array.isArray(requestOptions.excludedCampaignIds)
            ? requestOptions.excludedCampaignIds
            : [];
        const excludedCampaignNameKeywords = normalizeCampaignNameKeywords(
            requestOptions.excludedCampaignNameKeywords
        );
        const forceCampaignQuery =
            requestOptions.forceCampaignQuery === true ||
            adCampaignFilterActive(excludedCampaignIds.length > 0, excludedCampaignNameKeywords);
        if (!customerId) {
                if (!quietLog) console.error('Google Ads customerId is missing or undefined:', customerId);
                throw new Error('Google Ads customerId is missing or undefined');
        }
        const customerIdStr = String(customerId);

        const customer = createGoogleAdsApiCustomer(customerIdStr);

        // First, fetch the customer's currency code
        let currencyCode = 'DKK'; // Default fallback
        try {
                const customerQuery = `
                        SELECT 
                        customer.currency_code
                        FROM customer
                        LIMIT 1
                `;
                const customerRes = await customer.query(customerQuery);
                const customerData = Array.isArray(customerRes) ? customerRes[0] : (customerRes.results?.[0]);
                if (customerData?.customer?.currency_code) {
                        currencyCode = customerData.customer.currency_code;
                }
        } catch (err) {
                if (!quietLog) {
                        console.warn(
                                'Could not fetch customer currency code, using default:',
                                err?.message ?? err
                        );
                }
        }

        const hasInclude = typeof countryFilter === 'string' && countryFilter.trim().length > 0;
        const hasExclude = typeof countryExclude === 'string' && countryExclude.trim().length > 0;
        const hasAnyFilter = !forceCampaignQuery && (hasInclude || hasExclude);
        let metrics;

        if (forceCampaignQuery && (hasInclude || hasExclude) && !quietLog) {
                console.warn(
                        'Google Ads: campaign exclusions use campaign-level query; country include/exclude is not applied for this fetch.'
                );
        }

        const resolveIds = async (inputStr) => {
                const inputs = inputStr.split(',').map((c) => c.trim()).filter(Boolean);
                const ids = [];
                const skipped = [];
                for (const inp of inputs) {
                        const id = await resolveCountryToCriterionId(customer, inp);
                        if (id != null) ids.push(id);
                        else skipped.push(inp);
                }
                if (skipped.length > 0 && !quietLog) {
                        const preview = skipped.slice(0, 8).join(', ');
                        const more =
                                skipped.length > 8 ? ` (+${skipped.length - 8} more)` : '';
                        console.warn(
                                `Google Ads country filter: ${skipped.length} unknown territories skipped (e.g. ${preview}${more})`
                        );
                }
                return [...new Set(ids)];
        };

        if (hasAnyFilter) {
                let includeIds = [];
                let excludeIds = [];
                if (hasInclude) includeIds = await resolveIds(countryFilter);
                if (hasExclude) excludeIds = await resolveIds(countryExclude);

                const effectiveIncludeIds = hasInclude
                        ? includeIds.filter((id) => !excludeIds.includes(id))
                        : null;

                if (hasInclude && effectiveIncludeIds.length === 0) {
                        console.warn('Google Ads country filter: all included countries were excluded, falling back to unfiltered');
                }

                const useLocationView = (hasInclude && effectiveIncludeIds.length > 0) || (hasExclude && !hasInclude);
                if (useLocationView) {
                        const idsList = effectiveIncludeIds?.length
                                ? effectiveIncludeIds.join(', ')
                                : null;
                        const whereCountry = idsList
                                ? `AND user_location_view.country_criterion_id IN (${idsList})`
                                : '';
                        const countryQuery = `
                                SELECT 
                                user_location_view.country_criterion_id,
                                segments.date,
                                metrics.clicks,
                                metrics.impressions,
                                metrics.conversions,
                                metrics.conversions_value,
                                metrics.cost_micros
                                FROM user_location_view
                                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                                ${whereCountry}
                                ORDER BY segments.date ASC
                        `;
                        try {
                                const res = await customer.query(countryQuery);
                                let rows = Array.isArray(res) ? res : (res.results || []);
                                if (hasExclude && excludeIds.length > 0) {
                                        rows = rows.filter(
                                                (r) => !excludeIds.includes(Number(r.user_location_view?.country_criterion_id ?? r.country_criterion_id))
                                        );
                                }
                                metrics = rows;
                        } catch (err) {
                                if (!quietLog) console.error('Google Ads API error (user_location_view):', err);
                                throw err;
                        }
                }
        }

        if (!metrics) {
                const metricsQuery = `
                        SELECT 
                        campaign.id,
                        campaign.name,
                        segments.date,
                        metrics.clicks,
                        metrics.impressions,
                        metrics.conversions,
                        metrics.conversions_value,
                        metrics.cost_micros
                        FROM campaign
                        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                        ORDER BY segments.date ASC
                `;
                try {
                        const res = await customer.query(metricsQuery);
                        metrics = Array.isArray(res) ? res : (res.results || []);
                } catch (err) {
                        if (!quietLog) console.error('Google Ads API error:', err);
                        throw err;
                }
        }

        metrics = filterMetricsByExcludedCampaigns(
            metrics,
            excludedCampaignIds,
            excludedCampaignNameKeywords
        );

        return { metrics, currencyCode };
}

/**
 * Fetches Google Ads metrics (supports comma-separated Google Ads customer IDs).
 */
export async function fetchGoogleAdsMetrics(
    customerId,
    startDate,
    endDate,
    countryFilter,
    countryExclude,
    requestOptions = {}
) {
    const ids = parseGoogleAdsCustomerIds(customerId);
    if (ids.length <= 1) {
        const single = ids[0] ?? String(customerId ?? "").trim();
        return fetchGoogleAdsMetricsForOne(
            single,
            startDate,
            endDate,
            countryFilter,
            countryExclude,
            requestOptions
        );
    }
    const quietLog = requestOptions.quietLog === true;
    const results = await Promise.all(
        ids.map((id) =>
            fetchGoogleAdsMetricsForOne(
                id,
                startDate,
                endDate,
                countryFilter,
                countryExclude,
                { ...requestOptions, quietLog: true }
            )
        )
    );
    const currencyCode = results[0]?.currencyCode ?? "DKK";
    if (!quietLog) {
        const currencies = new Set(results.map((r) => r.currencyCode).filter(Boolean));
        if (currencies.size > 1) {
            console.warn(
                "Google Ads: multiple customer IDs use different currencies; using",
                currencyCode,
                "for conversion. Accounts:",
                [...currencies].join(", ")
            );
        }
    }
    const metrics = results.flatMap((r) => r.metrics || []);
    return { metrics, currencyCode };
}

/**
 * Resolve Google Ads location criterion IDs to ISO-2 country codes.
 * @param {ReturnType<typeof createGoogleAdsApiCustomer>} customer
 * @param {number[]} criterionIds
 * @returns {Promise<Map<number, string>>}
 */
async function resolveCriterionIdsToIso2(customer, criterionIds) {
    /** @type {Map<number, string>} */
    const out = new Map();
    const ids = [...new Set(criterionIds.filter((id) => Number.isFinite(id) && id > 0))];
    for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const idList = chunk.join(", ");
        const q = `
            SELECT geo_target_constant.id, geo_target_constant.country_code
            FROM geo_target_constant
            WHERE geo_target_constant.id IN (${idList})
        `;
        try {
            const res = await customer.query(q);
            const rows = Array.isArray(res) ? res : res.results || [];
            for (const row of rows) {
                const id = Number(row?.geo_target_constant?.id);
                const code = String(row?.geo_target_constant?.country_code || "")
                    .trim()
                    .toUpperCase();
                if (id && code.length === 2) out.set(id, code);
            }
        } catch (_) {
            /* skip chunk */
        }
    }
    return out;
}

/**
 * Total spend by ISO-2 from user_location_view (one query, all countries).
 * @returns {Promise<Map<string, number>>}
 */
async function fetchGoogleAdsSpendByIso2MapForOne(
    customerId,
    startDate,
    endDate,
    requestOptions = {}
) {
    const quietLog = requestOptions.quietLog === true;
    if (!customerId) return { byIso: new Map(), currencyCode: "DKK" };
    const customer = createGoogleAdsApiCustomer(String(customerId));

    let currencyCode = "DKK";
    try {
        const customerQuery = `
            SELECT customer.currency_code
            FROM customer
            LIMIT 1
        `;
        const customerRes = await customer.query(customerQuery);
        const customerData = Array.isArray(customerRes)
            ? customerRes[0]
            : customerRes.results?.[0];
        if (customerData?.customer?.currency_code) {
            currencyCode = customerData.customer.currency_code;
        }
    } catch (_) {
        /* default DKK */
    }
    const countryQuery = `
        SELECT
            user_location_view.country_criterion_id,
            metrics.cost_micros
        FROM user_location_view
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;
    try {
        const res = await customer.query(countryQuery);
        const rows = Array.isArray(res) ? res : res.results || [];
        /** @type {Map<number, number>} */
        const byCriterion = new Map();
        for (const row of rows) {
            const id = Number(
                row.user_location_view?.country_criterion_id ?? row.country_criterion_id
            );
            if (!id) continue;
            const cost = row.metrics?.cost_micros ? row.metrics.cost_micros / 1e6 : 0;
            byCriterion.set(id, (byCriterion.get(id) || 0) + cost);
        }
        const idToIso = await resolveCriterionIdsToIso2(customer, [...byCriterion.keys()]);
        /** @type {Map<string, number>} */
        const byIso = new Map();
        for (const [id, cost] of byCriterion) {
            const iso = idToIso.get(id);
            if (!iso) continue;
            byIso.set(iso, (byIso.get(iso) || 0) + cost);
        }
        return { byIso, currencyCode };
    } catch (err) {
        if (!quietLog) console.error("Google Ads spend by country:", err);
        return { byIso: new Map(), currencyCode };
    }
}

/**
 * Spend by country (supports comma-separated Google Ads customer IDs).
 */
export async function fetchGoogleAdsSpendByIso2Map(
    customerId,
    startDate,
    endDate,
    requestOptions = {}
) {
    const ids = parseGoogleAdsCustomerIds(customerId);
    if (ids.length <= 1) {
        const single = ids[0] ?? String(customerId ?? "").trim();
        return fetchGoogleAdsSpendByIso2MapForOne(single, startDate, endDate, requestOptions);
    }
    const results = await Promise.all(
        ids.map((id) =>
            fetchGoogleAdsSpendByIso2MapForOne(id, startDate, endDate, {
                ...requestOptions,
                quietLog: true,
            })
        )
    );
    const currencyCode = results[0]?.currencyCode ?? "DKK";
    /** @type {Map<string, number>} */
    const byIso = new Map();
    for (const { byIso: map } of results) {
        for (const [iso, cost] of map || []) {
            byIso.set(iso, (byIso.get(iso) || 0) + cost);
        }
    }
    return { byIso, currencyCode };
}
