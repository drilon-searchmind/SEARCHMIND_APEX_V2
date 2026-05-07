// src/lib/googleAdsApi.js
import { GoogleAdsApi } from 'google-ads-api';

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

/**
 * Fetches Google Ads metrics for a given customer ID and date range.
 * @param {string} customerId - Google Ads customer ID (from CustomerSettings)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} [countryFilter] - Optional comma-separated countries to INCLUDE (e.g. "Germany,Denmark,Norway")
 * @param {string} [countryExclude] - Optional comma-separated countries to EXCLUDE (e.g. "France,Spain")
 * @param {{ quietLog?: boolean }} [requestOptions] - When `quietLog`, avoid console noise for expected per-customer failures (overview batch).
 * @returns {Promise<{metrics: object[], currencyCode: string}>} - Raw rows from Google Ads API and customer currency code
 */
export async function fetchGoogleAdsMetrics(
    customerId,
    startDate,
    endDate,
    countryFilter,
    countryExclude,
    requestOptions = {}
) {
        const quietLog = requestOptions.quietLog === true;
        if (!customerId) {
                if (!quietLog) console.error('Google Ads customerId is missing or undefined:', customerId);
                throw new Error('Google Ads customerId is missing or undefined');
        }
        const customerIdStr = String(customerId);

        // Use all credentials from .env
        const client = new GoogleAdsApi({
                client_id: process.env.GOOGLE_ADS_CLIENT_ID,
                client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
                developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        });
        const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN;
        const managerCustomerId = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;

        // Support MCC (login_customer_id)
        const customer = client.Customer({
                customer_id: customerIdStr,
                refresh_token,
                login_customer_id: managerCustomerId || undefined,
        });

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
        const hasAnyFilter = hasInclude || hasExclude;
        let metrics;

        const resolveIds = async (inputStr) => {
                const inputs = inputStr.split(',').map((c) => c.trim()).filter(Boolean);
                const ids = [];
                for (const inp of inputs) {
                        const id = await resolveCountryToCriterionId(customer, inp);
                        if (id != null) ids.push(id);
                        else console.warn('Google Ads country filter: unknown country skipped:', inp);
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

        return { metrics, currencyCode };
}
