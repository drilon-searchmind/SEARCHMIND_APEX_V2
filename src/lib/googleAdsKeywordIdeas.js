// src/lib/googleAdsKeywordIdeas.js
import { GoogleAdsApi } from 'google-ads-api';
import dayjs from 'dayjs';
import { resolveCountryToCriterionId } from '@/lib/googleAdsApi';
import { isWorldwideGeoValue } from '@/lib/countrySelectOptions';

const GOOGLE_ADS_API_VERSION = 'v21';

const MONTH_OF_YEAR = {
    JANUARY: 1,
    FEBRUARY: 2,
    MARCH: 3,
    APRIL: 4,
    MAY: 5,
    JUNE: 6,
    JULY: 7,
    AUGUST: 8,
    SEPTEMBER: 9,
    OCTOBER: 10,
    NOVEMBER: 11,
    DECEMBER: 12,
};

function normalizeCustomerId(id) {
    return String(id ?? '').replace(/\D/g, '');
}

export function createGoogleAdsCustomer(googleAdsCustomerId) {
    const cid = normalizeCustomerId(googleAdsCustomerId);
    if (!cid) {
        throw new Error('Missing Google Ads customer ID');
    }
    const client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    const manager = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;
    return client.Customer({
        customer_id: cid,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        login_customer_id: manager ? normalizeCustomerId(manager) : undefined,
    });
}

function escapeGaql(s) {
    return String(s).replace(/'/g, "''");
}

export async function resolveLanguageResourceName(customer, languageCode = 'da') {
    const code = escapeGaql((languageCode || 'da').toLowerCase());
    const tryCode = async (c) => {
        const q = `SELECT language_constant.resource_name FROM language_constant WHERE language_constant.code = '${c}' LIMIT 1`;
        const res = await customer.query(q);
        const rows = Array.isArray(res) ? res : res.results || [];
        return rows[0]?.language_constant?.resource_name || null;
    };
    let name = await tryCode(code);
    if (!name) name = await tryCode('en');
    if (!name && code === 'da') name = 'languageConstants/1009';
    if (!name) name = 'languageConstants/1000';
    return name;
}

function toYearMonth(isoDate) {
    const d = dayjs(isoDate);
    const year = d.year();
    const monthNames = [
        'JANUARY',
        'FEBRUARY',
        'MARCH',
        'APRIL',
        'MAY',
        'JUNE',
        'JULY',
        'AUGUST',
        'SEPTEMBER',
        'OCTOBER',
        'NOVEMBER',
        'DECEMBER',
    ];
    return { year, month: monthNames[d.month()] };
}

function monthsKeySet(startDate, endDate) {
    const set = new Set();
    let d = dayjs(startDate).startOf('month');
    const end = dayjs(endDate).endOf('month');
    while (d.isBefore(end) || d.isSame(end, 'month')) {
        set.add(d.format('YYYY-MM'));
        d = d.add(1, 'month');
    }
    return set;
}

function monthKeyFromApi(m) {
    const y = Number(m.year);
    const mon = m.month;
    const num = typeof mon === 'number' ? mon : MONTH_OF_YEAR[String(mon).toUpperCase()];
    if (!y || !num) return null;
    return `${y}-${String(num).padStart(2, '0')}`;
}

function volumeInSelectedMonths(metrics, monthSet) {
    if (!metrics) return 0;
    const months = metrics.monthlySearchVolumes || metrics.monthly_search_volumes;
    if (Array.isArray(months) && months.length > 0) {
        let sum = 0;
        for (const m of months) {
            const key = monthKeyFromApi(m);
            if (key && monthSet.has(key)) {
                sum += Number(m.monthlySearches ?? m.monthly_searches ?? 0);
            }
        }
        return sum;
    }
    const avg = Number(metrics.avgMonthlySearches ?? metrics.avg_monthly_searches ?? 0);
    return avg;
}

function normalizeResultRow(r) {
    const text = r.text ?? r.keywordText ?? '';
    const metrics = r.keywordIdeaMetrics ?? r.keyword_idea_metrics ?? null;
    const closeVariants = r.closeVariants ?? r.close_variants ?? [];
    return { text, metrics, closeVariants };
}

function buildResultMap(apiResults) {
    const list = (apiResults || []).map(normalizeResultRow);
    const byText = new Map();
    for (const row of list) {
        byText.set(row.text.toLowerCase(), row);
    }
    return { list, byText };
}

function findRowForBrand(brand, { list, byText }) {
    const b = brand.trim();
    if (!b) return null;
    const low = b.toLowerCase();
    if (byText.has(low)) return byText.get(low);
    for (const row of list) {
        if (row.closeVariants?.some((v) => String(v).toLowerCase() === low)) {
            return row;
        }
    }
    for (const row of list) {
        if (row.text.toLowerCase() === low) return row;
    }
    return null;
}

function pickMetricsForBrand(brand, map) {
    return findRowForBrand(brand, map)?.metrics ?? null;
}

async function postGenerateKeywordIdeas(customer, body) {
    const accessToken = await customer.getAccessToken();
    const customerId = normalizeCustomerId(customer.credentials.customer_id);
    const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}:generateKeywordIdeas`;
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
    };
    const manager = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;
    if (manager) {
        headers['login-customer-id'] = normalizeCustomerId(manager);
    }
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Google Ads Keyword Planner (${res.status}): ${text.slice(0, 2000)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error('Invalid JSON from Google Ads Keyword Planner');
    }
}

/**
 * @param {object} params
 * @param {string} params.googleAdsCustomerId
 * @param {string[]} params.brands
 * @param {string} params.geoLabel - country name or ISO code
 * @param {string} [params.languageCode]
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 */
export async function fetchBrandSearchMetrics({
    googleAdsCustomerId,
    brands,
    geoLabel,
    languageCode = 'da',
    startDate,
    endDate,
}) {
    const cleanBrands = [...new Set(brands.map((b) => String(b).trim()).filter(Boolean))];
    if (cleanBrands.length === 0) {
        throw new Error('Add at least one brand');
    }
    if (cleanBrands.length > 20) {
        throw new Error('Maximum 20 brands per request');
    }

    let startD = dayjs(startDate);
    let endD = dayjs(endDate);
    if (endD.isBefore(startD)) {
        const t = startD;
        startD = endD;
        endD = t;
    }
    const months = endD.diff(startD, 'month', true);
    if (months > 48) {
        throw new Error('Date range cannot exceed 48 months (Keyword Planner historical limit)');
    }
    const startIso = startD.format('YYYY-MM-DD');
    const endIso = endD.format('YYYY-MM-DD');

    const customer = createGoogleAdsCustomer(googleAdsCustomerId);
    const worldwide = isWorldwideGeoValue(geoLabel);
    let geoId = null;
    if (!worldwide) {
        geoId = await resolveCountryToCriterionId(customer, geoLabel || 'Denmark');
        if (geoId == null) {
            throw new Error(`Unknown location: ${geoLabel || 'Denmark'}`);
        }
    }
    const language = await resolveLanguageResourceName(customer, languageCode);
    const monthSet = monthsKeySet(startIso, endIso);

    const baseBody = {
        language,
        ...(worldwide
            ? {}
            : { geoTargetConstants: [`geoTargetConstants/${geoId}`] }),
        includeAdultKeywords: false,
        keywordPlanNetwork: 'GOOGLE_SEARCH',
        historicalMetricsOptions: {
            yearMonthRange: {
                start: toYearMonth(startIso),
                end: toYearMonth(endIso),
            },
        },
        pageSize: 1000,
    };

    const combined = await postGenerateKeywordIdeas(customer, {
        ...baseBody,
        keywordSeed: { keywords: cleanBrands },
    });

    let apiRows = combined.results || combined.generateKeywordIdeasResults || [];
    const map = buildResultMap(apiRows);

    const missing = cleanBrands.filter((b) => !pickMetricsForBrand(b, map));
    if (missing.length > 0) {
        for (const brand of missing) {
            try {
                const one = await postGenerateKeywordIdeas(customer, {
                    ...baseBody,
                    keywordSeed: { keywords: [brand] },
                });
                const extra = one.results || one.generateKeywordIdeasResults || [];
                apiRows = apiRows.concat(extra);
            } catch {
                /* keep going */
            }
        }
    }

    const finalMap = buildResultMap(apiRows);
    const rows = [];
    for (const brand of cleanBrands) {
        const metrics = pickMetricsForBrand(brand, finalMap);
        const hit = findRowForBrand(brand, finalMap);
        const vol = metrics ? volumeInSelectedMonths(metrics, monthSet) : 0;
        rows.push({
            brand,
            apiKeywordText: hit?.text || brand,
            volumeInRange: vol,
            avgMonthlySearches: metrics
                ? Number(metrics.avgMonthlySearches ?? metrics.avg_monthly_searches ?? 0)
                : 0,
            monthlySearchVolumes: metrics?.monthlySearchVolumes ?? metrics?.monthly_search_volumes ?? [],
        });
    }

    const totalVol = rows.reduce((s, r) => s + (r.volumeInRange || 0), 0);
    for (const r of rows) {
        r.sharePct = totalVol > 0 ? Math.round((r.volumeInRange / totalVol) * 10000) / 100 : 0;
    }

    return {
        geoCriterionId: geoId,
        worldwide,
        language,
        rows,
        rawResultCount: apiRows.length,
        normalizedStartDate: startIso,
        normalizedEndDate: endIso,
    };
}
