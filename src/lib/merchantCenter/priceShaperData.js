import dayjs from "dayjs";
import {
    normalizeMerchantAccountId,
    resolveMerchantAccountSlot,
} from "./merchantCenterAccounts";
import {
    mapReportRows,
    parseMerchantPrice,
    searchMerchantReportsWithSlotFallback,
} from "./merchantCenterReports";
import { hasMerchantCredentials, normalizeMerchantAccountSlot } from "./merchantCenterAuth";

const SIMILAR_THRESHOLD = 0.02;

export const PRICE_INDEX_INITIAL_PRODUCT_LIMIT = 25;

/** @type {Record<string, string>} */
const CURRENCY_TO_COUNTRY = {
    DKK: "DK",
    NOK: "NO",
    SEK: "SE",
    EUR: "DE",
    GBP: "GB",
    USD: "US",
};

/**
 * @param {string | undefined} currencyCode
 * @returns {string | null}
 */
export function resolveReportCountryCode(currencyCode) {
    const code = String(currencyCode || "").trim().toUpperCase();
    return CURRENCY_TO_COUNTRY[code] || null;
}

/**
 * @param {number} price
 * @param {number} benchmark
 * @returns {"cheaper" | "similar" | "expensive" | null}
 */
export function classifyPriceVsBenchmark(price, benchmark) {
    if (!Number.isFinite(price) || !Number.isFinite(benchmark) || benchmark <= 0) {
        return null;
    }
    const ratio = price / benchmark;
    if (ratio < 1 - SIMILAR_THRESHOLD) return "cheaper";
    if (ratio > 1 + SIMILAR_THRESHOLD) return "expensive";
    return "similar";
}

/**
 * Price index score (1–100) from average price vs Google benchmark.
 * 50 ≈ at benchmark; higher = cheaper vs market.
 * @param {Array<{ price: number | null, benchmark: number | null }>} rows
 * @returns {number | null}
 */
export function computePriceIndexScore(rows) {
    const details = computePriceIndexScoreDetails(rows);
    return details?.score ?? null;
}

/**
 * @param {Array<{ price: number | null, benchmark: number | null }>} rows
 */
export function computePriceIndexScoreDetails(rows) {
    const valid = rows.filter(
        (row) => Number.isFinite(row.price) && Number.isFinite(row.benchmark) && row.benchmark > 0
    );
    if (valid.length === 0) return null;

    const ratios = valid.map((row) => row.price / row.benchmark);
    const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    const raw = 50 + (1 - avgRatio) * 100;
    const score = Math.min(100, Math.max(1, Math.round(raw)));

    return {
        score,
        label: getPriceIndexScoreLabel(score),
        productCount: valid.length,
        avgPriceRatio: avgRatio,
        /** Average price as % of Google benchmark (100 = matched). */
        avgVsBenchmarkPct: Math.round(avgRatio * 1000) / 10,
    };
}

/**
 * @param {number | null} score
 * @returns {string}
 */
export function getPriceIndexScoreLabel(score) {
    if (score == null) return "No data";
    if (score >= 75) return "Very competitive";
    if (score >= 60) return "Competitive";
    if (score >= 45) return "Average";
    if (score >= 30) return "Below average";
    return "Needs attention";
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeCategoryName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function parseMerchantBoolean(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    const normalized = String(value).trim().toLowerCase();
    return normalized === "true" || normalized === "1";
}

/**
 * @param {Record<string, unknown>} row
 * @param {Map<string, string>} categoryByKey
 * @returns {string}
 */
function resolveCategoryL1(row, categoryByKey) {
    const direct = String(row.categoryL1 ?? row.category_l1 ?? "").trim();
    if (direct) return direct;
    for (const key of getProductMatchKeys(row)) {
        const category = categoryByKey.get(key);
        if (category) return category;
    }
    return "";
}

/**
 * @param {Array<{ categoryL1?: string }>} rows
 * @returns {Array<{ name: string, count: number }>}
 */
function tallyCategoryL1(rows) {
    /** @type {Map<string, { name: string, count: number }>} */
    const counts = new Map();
    for (const row of rows) {
        const name = String(row.categoryL1 || "").trim();
        if (!name) continue;
        const key = normalizeCategoryName(name);
        const entry = counts.get(key) || { name, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
}

/**
 * @param {Record<string, unknown>} row
 */
function normalizeCompetitorRow(row) {
    return {
        domain: String(row.domain || "").trim(),
        isYourDomain: parseMerchantBoolean(row.isYourDomain ?? row.is_your_domain),
        rank: Number(row.rank) || null,
        pageOverlapRate: Number(row.pageOverlapRate ?? row.page_overlap_rate) || 0,
        higherPositionRate: Number(row.higherPositionRate ?? row.higher_position_rate) || 0,
        relativeVisibility: Number(row.relativeVisibility ?? row.relative_visibility) || 0,
        reportCategoryId: Number(row.reportCategoryId ?? row.report_category_id) || null,
    };
}

/**
 * @param {import("./merchantCenterAuth").MerchantOAuthSlot} accountSlot
 * @param {string} merchantAccountId
 * @param {string} countryCode
 * @param {Array<{ name: string, count: number }>} merchantCategories
 * @returns {Promise<Array<{ id: number, label: string }>>}
 */
async function resolveCategoryIdsForCompetitors(
    accountSlot,
    merchantAccountId,
    countryCode,
    merchantCategories
) {
    if (!countryCode) return [];

    const safeCountry = countryCode.replace(/'/g, "''");
    const taxonomyQuery =
        "SELECT report_date, report_granularity, report_country_code, report_category_id, category_l1" +
        " FROM best_sellers_product_cluster_view" +
        ` WHERE report_granularity = 'WEEK' AND report_country_code = '${safeCountry}'`;

    /** @type {Map<number, string>} */
    let idToLabel = new Map();

    try {
        const taxonomyResult = await searchMerchantReportsWithSlotFallback(
            accountSlot,
            merchantAccountId,
            taxonomyQuery,
            { maxPages: 5 }
        );
        for (const raw of mapReportRows(
            taxonomyResult.rows,
            "best_sellers_product_cluster_view"
        )) {
            const id = Number(raw.reportCategoryId ?? raw.report_category_id);
            const label = String(raw.categoryL1 ?? raw.category_l1 ?? "").trim();
            if (Number.isFinite(id) && id > 0 && !idToLabel.has(id)) {
                idToLabel.set(id, label || `Category ${id}`);
            }
        }
    } catch (error) {
        console.warn("price index: category taxonomy lookup failed:", error?.message || error);
    }

    if (idToLabel.size === 0) {
        idToLabel = new Map([
            [166, "Apparel & Accessories"],
            [536, "Home & Garden"],
            [888, "Sporting Goods"],
        ]);
    }

    if (merchantCategories.length > 0) {
        const merchantKeys = new Set(
            merchantCategories.map((entry) => normalizeCategoryName(entry.name))
        );
        const matched = [...idToLabel.entries()]
            .filter(([_, label]) => merchantKeys.has(normalizeCategoryName(label)))
            .map(([id, label]) => ({ id, label }));
        if (matched.length > 0) {
            return matched.slice(0, 3);
        }
    }

    return [...idToLabel.entries()]
        .slice(0, 3)
        .map(([id, label]) => ({ id, label }));
}

/**
 * @param {import("./merchantCenterAuth").MerchantOAuthSlot} accountSlot
 * @param {string} merchantAccountId
 * @param {string | null} reportCountryCode
 * @param {Array<{ categoryL1?: string }>} competitivenessRows
 * @param {number} [lookbackDays]
 */
async function fetchTopCompetitors(
    accountSlot,
    merchantAccountId,
    reportCountryCode,
    competitivenessRows,
    lookbackDays = 28
) {
    const countryCode = reportCountryCode ? String(reportCountryCode).trim().toUpperCase() : null;
    if (!countryCode) return [];

    const merchantCategories = tallyCategoryL1(competitivenessRows);
    const categoryIds = await resolveCategoryIdsForCompetitors(
        accountSlot,
        merchantAccountId,
        countryCode,
        merchantCategories
    );
    if (categoryIds.length === 0) return [];

    const endDate = dayjs().subtract(1, "day");
    const startDate = endDate.subtract(lookbackDays - 1, "day");
    const dateFilter = `date BETWEEN '${startDate.format("YYYY-MM-DD")}' AND '${endDate.format("YYYY-MM-DD")}'`;
    const safeCountry = countryCode.replace(/'/g, "''");
    const trafficSources = ["ADS", "ORGANIC"];

    /** @type {Map<string, { domain: string, pageOverlapRate: number, relativeVisibility: number, bestRank: number | null, categoryLabel: string, samples: number }>} */
    const byDomain = new Map();

    const ingestRows = (rows, viewKey, categoryLabel) => {
        for (const raw of mapReportRows(rows, viewKey)) {
            const row = normalizeCompetitorRow(raw);
            if (!row.domain || row.isYourDomain) continue;

            const key = row.domain.toLowerCase();
            const existing = byDomain.get(key) || {
                domain: row.domain,
                pageOverlapRate: 0,
                relativeVisibility: 0,
                bestRank: row.rank,
                categoryLabel,
                samples: 0,
            };

            existing.pageOverlapRate = Math.max(existing.pageOverlapRate, row.pageOverlapRate);
            existing.relativeVisibility = Math.max(
                existing.relativeVisibility,
                row.relativeVisibility
            );
            if (row.rank != null) {
                existing.bestRank =
                    existing.bestRank == null ? row.rank : Math.min(existing.bestRank, row.rank);
            }
            existing.samples += 1;
            byDomain.set(key, existing);
        }
    };

    for (const category of categoryIds) {
        for (const trafficSource of trafficSources) {
            const competitorQuery =
                "SELECT report_country_code, report_category_id, traffic_source, domain, is_your_domain, rank, page_overlap_rate, higher_position_rate, relative_visibility" +
                " FROM competitive_visibility_competitor_view" +
                ` WHERE ${dateFilter}` +
                ` AND report_country_code = '${safeCountry}'` +
                ` AND report_category_id = ${category.id}` +
                ` AND traffic_source = '${trafficSource}'`;

            try {
                const competitorResult = await searchMerchantReportsWithSlotFallback(
                    accountSlot,
                    merchantAccountId,
                    competitorQuery,
                    { maxPages: 5 }
                );
                ingestRows(
                    competitorResult.rows,
                    "competitive_visibility_competitor_view",
                    category.label
                );
            } catch (error) {
                console.warn(
                    `price index: competitor lookup failed for category ${category.id} (${trafficSource}):`,
                    error?.message || error
                );
            }
        }
    }

    if (byDomain.size === 0) {
        for (const category of categoryIds) {
            for (const trafficSource of trafficSources) {
                const topMerchantQuery =
                    "SELECT report_country_code, report_category_id, traffic_source, domain, is_your_domain, rank, page_overlap_rate, higher_position_rate" +
                    " FROM competitive_visibility_top_merchant_view" +
                    ` WHERE ${dateFilter}` +
                    ` AND report_country_code = '${safeCountry}'` +
                    ` AND report_category_id = ${category.id}` +
                    ` AND traffic_source = '${trafficSource}'`;

                try {
                    const topMerchantResult = await searchMerchantReportsWithSlotFallback(
                        accountSlot,
                        merchantAccountId,
                        topMerchantQuery,
                        { maxPages: 5 }
                    );
                    ingestRows(
                        topMerchantResult.rows,
                        "competitive_visibility_top_merchant_view",
                        category.label
                    );
                } catch (error) {
                    console.warn(
                        `price index: top merchant lookup failed for category ${category.id} (${trafficSource}):`,
                        error?.message || error
                    );
                }
            }
        }
    }

    return [...byDomain.values()]
        .sort((a, b) => {
            if (b.pageOverlapRate !== a.pageOverlapRate) {
                return b.pageOverlapRate - a.pageOverlapRate;
            }
            if ((a.bestRank ?? 999) !== (b.bestRank ?? 999)) {
                return (a.bestRank ?? 999) - (b.bestRank ?? 999);
            }
            return b.relativeVisibility - a.relativeVisibility;
        })
        .slice(0, 5)
        .map((entry, index) => ({
            rank: index + 1,
            domain: entry.domain,
            pageOverlapPct: Math.round(entry.pageOverlapRate * 1000) / 10,
            relativeVisibilityPct: Math.round(entry.relativeVisibility * 1000) / 10,
            categoryLabel: entry.categoryLabel,
        }));
}

/**
 * @param {number} count
 * @returns {string}
 */
function formatProductCount(count) {
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}K`;
    }
    return count.toLocaleString("en-US");
}

/**
 * @param {{ cheaper: number, similar: number, expensive: number }} buckets
 * @returns {{ cheaperPct: number, similarPct: number, expensivePct: number }}
 */
function bucketPercentages(buckets) {
    const total = buckets.cheaper + buckets.similar + buckets.expensive;
    if (total <= 0) {
        return { cheaperPct: 0, similarPct: 0, expensivePct: 0 };
    }
    const round = (n) => Math.round(n * 10) / 10;
    return {
        cheaperPct: round((buckets.cheaper / total) * 100),
        similarPct: round((buckets.similar / total) * 100),
        expensivePct: round((buckets.expensive / total) * 100),
    };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {{ id: string, offerId: string, title: string, brand: string, price: number | null, benchmark: number | null, currencyCode: string, countryCode: string }}
 */
function normalizeCompetitivenessRow(row) {
    const priceParsed = parseMerchantPrice(row.price);
    const benchmarkParsed = parseMerchantPrice(row.benchmarkPrice ?? row.benchmark_price);
    const id = String(row.id || "");
    const offerId = String(row.offerId ?? row.offer_id ?? extractOfferIdFromProductId(id) ?? "");
    return {
        id,
        offerId,
        title: String(row.title || ""),
        brand: String(row.brand || "").trim() || "Unknown brand",
        categoryL1: String(row.categoryL1 ?? row.category_l1 ?? "").trim(),
        categoryL2: String(row.categoryL2 ?? row.category_l2 ?? "").trim(),
        price: priceParsed?.amount ?? null,
        benchmark: benchmarkParsed?.amount ?? null,
        currencyCode: priceParsed?.currencyCode || benchmarkParsed?.currencyCode || "DKK",
        countryCode: String(row.reportCountryCode ?? row.report_country_code ?? ""),
    };
}

/**
 * Merchant product REST ids use channel~language~feedLabel~offerId.
 * @param {string} id
 * @returns {string}
 */
export function extractOfferIdFromProductId(id) {
    const value = String(id || "").trim();
    if (!value) return "";
    if (value.includes("~")) {
        const parts = value.split("~");
        return parts[parts.length - 1] || "";
    }
    return value;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeLookupKey(value) {
    return String(value || "").trim().toLowerCase();
}

/**
 * @param {{ offerId?: string, id?: string }} row
 * @returns {string[]}
 */
function getProductMatchKeys(row) {
    const keys = new Set();
    const offerId = String(row.offerId || "").trim();
    const parsedOfferId = extractOfferIdFromProductId(row.id);
    for (const candidate of [offerId, parsedOfferId, row.id]) {
        const key = normalizeLookupKey(candidate);
        if (key) keys.add(key);
    }
    return [...keys];
}

/**
 * @param {Record<string, unknown>} row
 * @param {Map<string, number>} suggestedByKey
 * @returns {number | null}
 */
function resolveSuggestedPrice(row, suggestedByKey) {
    for (const key of getProductMatchKeys(row)) {
        const price = suggestedByKey.get(key);
        if (price != null && Number.isFinite(price)) return price;
    }
    return null;
}

/**
 * @param {{ offerId?: string, id?: string }} row
 * @param {Map<string, string>} thumbnailByKey
 * @returns {string | null}
 */
function resolveThumbnailUrl(row, thumbnailByKey) {
    for (const key of getProductMatchKeys(row)) {
        const thumb = thumbnailByKey.get(key);
        if (thumb) return thumb;
    }
    return null;
}

/**
 * @param {{ offerId?: string, id?: string }} row
 * @param {Map<string, { clicks: number }>} clicksByKey
 * @returns {number}
 */
function resolveClicks(row, clicksByKey) {
    for (const key of getProductMatchKeys(row)) {
        const hit = clicksByKey.get(key);
        if (hit) return hit.clicks;
    }
    return 0;
}

/**
 * @param {{
 *   merchantAccountId: string,
 *   accountSlot?: 1 | 2,
 *   reportCountryCode?: string | null,
 *   performanceDays?: number,
 *   includeAllProducts?: boolean,
 * }} opts
 */
export async function fetchPriceShaperData(opts) {
    const merchantAccountId = normalizeMerchantAccountId(opts.merchantAccountId);
    const preferredSlot = normalizeMerchantAccountSlot(opts.accountSlot);
    const reportCountryCode = opts.reportCountryCode
        ? String(opts.reportCountryCode).trim().toUpperCase()
        : null;
    const performanceDays = opts.performanceDays ?? 30;
    const includeAllProducts = opts.includeAllProducts === true;
    const auxiliaryMaxPages = includeAllProducts ? 10 : 3;

    if (!merchantAccountId) {
        throw new Error("Merchant Center account ID is not configured for this customer");
    }
    if (!hasMerchantCredentials(0) && !hasMerchantCredentials(1) && !hasMerchantCredentials(2)) {
        throw new Error("Merchant Center OAuth credentials are not configured");
    }

    const { slot: accountSlot, resolvedFromPreferred } = await resolveMerchantAccountSlot(
        merchantAccountId,
        preferredSlot
    );

    const countryFilter = reportCountryCode
        ? ` WHERE report_country_code = '${reportCountryCode.replace(/'/g, "''")}'`
        : "";

    const competitivenessQuery =
        "SELECT id, offer_id, title, brand, category_l1, price, report_country_code, benchmark_price" +
        " FROM price_competitiveness_product_view" +
        countryFilter;

    const endDate = dayjs().subtract(1, "day");
    const startDate = endDate.subtract(performanceDays - 1, "day");
    const performanceQuery =
        "SELECT offer_id, title, brand, clicks, impressions" +
        " FROM product_performance_view" +
        ` WHERE date BETWEEN '${startDate.format("YYYY-MM-DD")}' AND '${endDate.format("YYYY-MM-DD")}'`;

    const productViewQuery =
        "SELECT id, offer_id, title, brand, thumbnail_link, category_l1" +
        " FROM product_view";

    const priceInsightsQuery =
        "SELECT id, offer_id, title, price, suggested_price FROM price_insights_product_view";

    const [
        competitivenessResult,
        performanceResult,
        productViewResult,
        priceInsightsResult,
    ] = await Promise.all([
        searchMerchantReportsWithSlotFallback(accountSlot, merchantAccountId, competitivenessQuery),
        searchMerchantReportsWithSlotFallback(accountSlot, merchantAccountId, performanceQuery, {
            maxPages: includeAllProducts ? 15 : 8,
        }),
        searchMerchantReportsWithSlotFallback(accountSlot, merchantAccountId, productViewQuery, {
            maxPages: auxiliaryMaxPages,
        }),
        searchMerchantReportsWithSlotFallback(accountSlot, merchantAccountId, priceInsightsQuery, {
            maxPages: auxiliaryMaxPages,
        }).catch((error) => {
            console.warn("price index: price insights lookup failed:", error?.message || error);
            return { slot: accountSlot, rows: [] };
        }),
    ]);

    const competitivenessRowsRaw = competitivenessResult.rows;
    const performanceRowsRaw = performanceResult.rows;
    const productViewRowsRaw = productViewResult.rows;
    const priceInsightsRowsRaw = priceInsightsResult.rows;
    const effectiveSlot = competitivenessResult.slot;

    const competitivenessRows = mapReportRows(
        competitivenessRowsRaw,
        "price_competitiveness_product_view"
    ).map(normalizeCompetitivenessRow);

    const withBenchmark = competitivenessRows.filter(
        (row) => row.benchmark != null && row.benchmark > 0 && row.price != null
    );

    const summaryBuckets = { cheaper: 0, similar: 0, expensive: 0 };
    /** @type {Map<string, { brand: string, cheaper: number, similar: number, expensive: number, total: number }>} */
    const brandMap = new Map();

    for (const row of withBenchmark) {
        const bucket = classifyPriceVsBenchmark(row.price, row.benchmark);
        if (!bucket) continue;
        summaryBuckets[bucket] += 1;

        const brandKey = row.brand.toLowerCase();
        const entry = brandMap.get(brandKey) || {
            brand: row.brand,
            cheaper: 0,
            similar: 0,
            expensive: 0,
            total: 0,
        };
        entry[bucket] += 1;
        entry.total += 1;
        brandMap.set(brandKey, entry);
    }

    const summaryPct = bucketPercentages(summaryBuckets);

    const brands = [...brandMap.values()]
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
        .map((entry) => {
            const pct = bucketPercentages({
                cheaper: entry.cheaper,
                similar: entry.similar,
                expensive: entry.expensive,
            });
            return {
                brand: entry.brand,
                productCount: entry.total,
                ...pct,
            };
        });

    /** @type {Map<string, { offerId: string, title: string, brand: string, clicks: number, impressions: number }>} */
    const clicksByKey = new Map();
    for (const raw of mapReportRows(performanceRowsRaw, "product_performance_view")) {
        const offerId = String(raw.offerId ?? raw.offer_id ?? "").trim();
        if (!offerId) continue;
        const clicks = Number(raw.clicks) || 0;
        const impressions = Number(raw.impressions) || 0;
        const perfRow = {
            offerId,
            title: String(raw.title || ""),
            brand: String(raw.brand || ""),
            clicks: 0,
            impressions: 0,
        };

        for (const key of getProductMatchKeys({ offerId })) {
            const existing = clicksByKey.get(key);
            if (existing) {
                existing.clicks += clicks;
                existing.impressions += impressions;
            } else {
                clicksByKey.set(key, {
                    ...perfRow,
                    clicks,
                    impressions,
                });
            }
        }
    }

    /** @type {Map<string, string>} */
    const thumbnailByKey = new Map();
    /** @type {Map<string, string>} */
    const categoryByKey = new Map();
    /** @type {Map<string, number>} */
    const suggestedPriceByKey = new Map();

    for (const raw of mapReportRows(priceInsightsRowsRaw, "price_insights_product_view")) {
        const id = String(raw.id || "").trim();
        const offerId = String(raw.offerId ?? raw.offer_id ?? extractOfferIdFromProductId(id)).trim();
        const suggestedParsed = parseMerchantPrice(raw.suggestedPrice ?? raw.suggested_price);
        const suggestedAmount = suggestedParsed?.amount ?? null;
        if (suggestedAmount == null) continue;
        for (const key of getProductMatchKeys({ id, offerId })) {
            if (!suggestedPriceByKey.has(key)) suggestedPriceByKey.set(key, suggestedAmount);
        }
    }

    for (const raw of mapReportRows(productViewRowsRaw, "product_view")) {
        const id = String(raw.id || "").trim();
        const offerId = String(raw.offerId ?? raw.offer_id ?? extractOfferIdFromProductId(id)).trim();
        const thumb = String(raw.thumbnailLink ?? raw.thumbnail_link ?? "");
        const categoryL1 = String(raw.categoryL1 ?? raw.category_l1 ?? "").trim();
        for (const key of getProductMatchKeys({ id, offerId })) {
            if (thumb && !thumbnailByKey.has(key)) thumbnailByKey.set(key, thumb);
            if (categoryL1 && !categoryByKey.has(key)) categoryByKey.set(key, categoryL1);
        }
    }

    const withBenchmarkEnriched = withBenchmark.map((row) => ({
        ...row,
        categoryL1: resolveCategoryL1(row, categoryByKey),
    }));

    const sortedProducts = withBenchmarkEnriched
        .map((row) => ({
            id: row.id,
            offerId: row.offerId || extractOfferIdFromProductId(row.id),
            title: row.title,
            brand: row.brand,
            imageUrl: resolveThumbnailUrl(row, thumbnailByKey),
            yourPrice: row.price,
            benchmarkPrice: row.benchmark,
            suggestedPrice: resolveSuggestedPrice(row, suggestedPriceByKey),
            currencyCode: row.currencyCode,
            clicks: resolveClicks(row, clicksByKey),
            priceDelta: Math.abs((row.price ?? 0) - (row.benchmark ?? 0)),
        }))
        .sort((a, b) => {
            if (b.clicks !== a.clicks) return b.clicks - a.clicks;
            return b.priceDelta - a.priceDelta;
        })
        .map(({ priceDelta, ...product }) => product);

    const totalProductCount = sortedProducts.length;
    const products = includeAllProducts
        ? sortedProducts
        : sortedProducts.slice(0, PRICE_INDEX_INITIAL_PRODUCT_LIMIT);
    const productsTruncated =
        !includeAllProducts && totalProductCount > PRICE_INDEX_INITIAL_PRODUCT_LIMIT;

    const currencyCode =
        withBenchmark[0]?.currencyCode ||
        sortedProducts[0]?.currencyCode ||
        "DKK";

    const priceIndexDetails = computePriceIndexScoreDetails(withBenchmarkEnriched);
    const topCompetitors = await fetchTopCompetitors(
        effectiveSlot,
        merchantAccountId,
        reportCountryCode,
        withBenchmarkEnriched
    );

    return {
        reportCountryCode: reportCountryCode || null,
        merchantAccountId,
        oauthSlot: effectiveSlot,
        oauthSlotAutoResolved: !resolvedFromPreferred || effectiveSlot !== preferredSlot,
        performanceRange: {
            startDate: startDate.format("YYYY-MM-DD"),
            endDate: endDate.format("YYYY-MM-DD"),
        },
        currencyCode,
        priceIndexScore: priceIndexDetails?.score ?? null,
        priceIndexLabel: priceIndexDetails?.label ?? getPriceIndexScoreLabel(null),
        priceIndexDetails,
        summary: {
            productCount: withBenchmark.length,
            productCountLabel: formatProductCount(withBenchmark.length),
            ...summaryBuckets,
            ...summaryPct,
        },
        brands,
        topCompetitors,
        products,
        totalProductCount,
        productsTruncated,
    };
}

/** Demo payload mirroring Merchant Center Price Index layout. */
const DEMO_PRICE_INDEX_PRODUCTS = [
    { id: "demo-1", offerId: "demo-1", title: "Polymarine, 2-komponent lim, 290 ml, hvid", brand: "Polymarine", yourPrice: 389, benchmarkPrice: 365.32, suggestedPrice: 372, clicks: 48 },
    { id: "demo-2", offerId: "demo-2", title: "Talamex, dannebrog, 30 x 20 cm", brand: "Talamex", yourPrice: 2390, benchmarkPrice: 1880, suggestedPrice: 1950, clicks: 41 },
    { id: "demo-3", offerId: "demo-3", title: "Wema, kontakt, 10A, dobbelt pol", brand: "Wema", yourPrice: 145, benchmarkPrice: 152.5, suggestedPrice: 149, clicks: 36 },
    { id: "demo-4", offerId: "demo-4", title: "Dometic, køleskab CFX3 45", brand: "Dometic", yourPrice: 4299, benchmarkPrice: 3990, suggestedPrice: 4090, clicks: 32 },
    { id: "demo-5", offerId: "demo-5", title: "Rule, lænsepumpe 800 GPH", brand: "Rule", yourPrice: 649, benchmarkPrice: 712, suggestedPrice: 689, clicks: 28 },
    { id: "demo-6", offerId: "demo-6", title: "Osculati, fender 10 x 35 cm, hvid", brand: "Osculati", yourPrice: 189, benchmarkPrice: 175, suggestedPrice: 179, clicks: 27 },
    { id: "demo-7", offerId: "demo-7", title: "Vetus, bronze gennemføring 1 1/2 tomme", brand: "Vetus", yourPrice: 890, benchmarkPrice: 845, suggestedPrice: 860, clicks: 24 },
    { id: "demo-8", offerId: "demo-8", title: "Plastimo, kompas Offshore 115", brand: "Plastimo", yourPrice: 1199, benchmarkPrice: 1095, suggestedPrice: 1125, clicks: 22 },
    { id: "demo-9", offerId: "demo-9", title: "Blue Sea, sikringspanel 6 kredse", brand: "Blue Sea", yourPrice: 549, benchmarkPrice: 520, suggestedPrice: 529, clicks: 21 },
    { id: "demo-10", offerId: "demo-10", title: "Marinco, landstrømsstik 16A", brand: "Marinco", yourPrice: 329, benchmarkPrice: 298, suggestedPrice: 305, clicks: 19 },
    { id: "demo-11", offerId: "demo-11", title: "Harken, blok 40 mm enkelt", brand: "Harken", yourPrice: 459, benchmarkPrice: 488, suggestedPrice: 469, clicks: 18 },
    { id: "demo-12", offerId: "demo-12", title: "Spinlock, spinlock XTS 0814", brand: "Spinlock", yourPrice: 189, benchmarkPrice: 172, suggestedPrice: 178, clicks: 17 },
    { id: "demo-13", offerId: "demo-13", title: "Lopolight, navigation light LED", brand: "Lopolight", yourPrice: 2190, benchmarkPrice: 2050, suggestedPrice: 2090, clicks: 16 },
    { id: "demo-14", offerId: "demo-14", title: "Garmin, echoMAP UHD 72sv", brand: "Garmin", yourPrice: 6499, benchmarkPrice: 6190, suggestedPrice: 6290, clicks: 15 },
    { id: "demo-15", offerId: "demo-15", title: "Lewmar, ankerspil V700", brand: "Lewmar", yourPrice: 8990, benchmarkPrice: 8650, suggestedPrice: 8790, clicks: 14 },
    { id: "demo-16", offerId: "demo-16", title: "Seaflex, bådshampoo 1L", brand: "Seaflex", yourPrice: 89, benchmarkPrice: 79, suggestedPrice: 82, clicks: 13 },
    { id: "demo-17", offerId: "demo-17", title: "Sika, marine sealant 290 ml", brand: "Sika", yourPrice: 119, benchmarkPrice: 108, suggestedPrice: 112, clicks: 12 },
    { id: "demo-18", offerId: "demo-18", title: "Rutgerson, dekksgennemføring rustfri", brand: "Rutgerson", yourPrice: 245, benchmarkPrice: 228, suggestedPrice: 235, clicks: 11 },
    { id: "demo-19", offerId: "demo-19", title: "Ocean Safety, redningsvest 150N", brand: "Ocean Safety", yourPrice: 699, benchmarkPrice: 655, suggestedPrice: 669, clicks: 10 },
    { id: "demo-20", offerId: "demo-20", title: "Musto, MPX offshore jakke", brand: "Musto", yourPrice: 1899, benchmarkPrice: 1750, suggestedPrice: 1790, clicks: 9 },
    { id: "demo-21", offerId: "demo-21", title: "Gill, neopren handsker", brand: "Gill", yourPrice: 349, benchmarkPrice: 329, suggestedPrice: 335, clicks: 8 },
    { id: "demo-22", offerId: "demo-22", title: "Selden, mastefod bøjning 30 mm", brand: "Selden", yourPrice: 1290, benchmarkPrice: 1210, suggestedPrice: 1240, clicks: 7 },
    { id: "demo-23", offerId: "demo-23", title: "Fortress, anker FX-7", brand: "Fortress", yourPrice: 2790, benchmarkPrice: 2650, suggestedPrice: 2690, clicks: 6 },
    { id: "demo-24", offerId: "demo-24", title: "Scanstrut, radar bøjning", brand: "Scanstrut", yourPrice: 1590, benchmarkPrice: 1495, suggestedPrice: 1525, clicks: 5 },
    { id: "demo-25", offerId: "demo-25", title: "Whale, vandpumpe Gusher 10", brand: "Whale", yourPrice: 899, benchmarkPrice: 860, suggestedPrice: 875, clicks: 4 },
    { id: "demo-26", offerId: "demo-26", title: "C-MAP, kortpakke Discover X", brand: "C-MAP", yourPrice: 1199, benchmarkPrice: 1140, suggestedPrice: 1160, clicks: 3 },
    { id: "demo-27", offerId: "demo-27", title: "Ronstan, snap shackle 80 mm", brand: "Ronstan", yourPrice: 279, benchmarkPrice: 265, suggestedPrice: 269, clicks: 3 },
    { id: "demo-28", offerId: "demo-28", title: "Climax, redningsflåde 4 personer", brand: "Climax", yourPrice: 4290, benchmarkPrice: 3990, suggestedPrice: 4090, clicks: 2 },
    { id: "demo-29", offerId: "demo-29", title: "B&G, vindmåler Triton²", brand: "B&G", yourPrice: 3490, benchmarkPrice: 3290, suggestedPrice: 3350, clicks: 2 },
    { id: "demo-30", offerId: "demo-30", title: "Mueller, propeller 3-blads 15x10", brand: "Mueller", yourPrice: 2890, benchmarkPrice: 2750, suggestedPrice: 2790, clicks: 1 },
].map((row) => ({
    ...row,
    imageUrl: null,
    currencyCode: "DKK",
}));

export function demoPriceShaperData(options = {}) {
    const includeAllProducts = options.includeAllProducts === true;
    const totalProductCount = 1330;
    const products = includeAllProducts
        ? DEMO_PRICE_INDEX_PRODUCTS
        : DEMO_PRICE_INDEX_PRODUCTS.slice(0, PRICE_INDEX_INITIAL_PRODUCT_LIMIT);
    const productsTruncated =
        !includeAllProducts && totalProductCount > products.length;

    return {
        demo: true,
        reportCountryCode: "DK",
        performanceRange: {
            startDate: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
            endDate: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
        },
        currencyCode: "DKK",
        priceIndexScore: 42,
        priceIndexLabel: "Average",
        priceIndexDetails: {
            score: 42,
            label: "Average",
            productCount: totalProductCount,
            avgPriceRatio: 1.08,
            avgVsBenchmarkPct: 108,
        },
        summary: {
            productCount: totalProductCount,
            productCountLabel: "1.33K",
            cheaper: 572,
            similar: 80,
            expensive: 678,
            cheaperPct: 43,
            similarPct: 6,
            expensivePct: 51,
        },
        brands: [
            { brand: "Polymarine", productCount: 120, cheaperPct: 29, similarPct: 0, expensivePct: 71 },
            { brand: "Wema", productCount: 95, cheaperPct: 83, similarPct: 4, expensivePct: 13 },
            { brand: "Dometic", productCount: 88, cheaperPct: 32, similarPct: 11, expensivePct: 57 },
        ],
        topCompetitors: [
            {
                rank: 1,
                domain: "marineshop.dk",
                pageOverlapPct: 38.5,
                relativeVisibilityPct: 124.2,
                categoryLabel: "Sporting Goods",
            },
            {
                rank: 2,
                domain: "boatgear.eu",
                pageOverlapPct: 31.2,
                relativeVisibilityPct: 98.4,
                categoryLabel: "Sporting Goods",
            },
            {
                rank: 3,
                domain: "nautica-outlet.com",
                pageOverlapPct: 27.8,
                relativeVisibilityPct: 86.1,
                categoryLabel: "Home & Garden",
            },
            {
                rank: 4,
                domain: "seaproshop.dk",
                pageOverlapPct: 22.4,
                relativeVisibilityPct: 74.5,
                categoryLabel: "Sporting Goods",
            },
            {
                rank: 5,
                domain: "decksupply.dk",
                pageOverlapPct: 19.6,
                relativeVisibilityPct: 61.3,
                categoryLabel: "Hardware",
            },
        ],
        products,
        totalProductCount,
        productsTruncated,
    };
}
