"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiRefreshCw, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useUser } from "@/contexts/UserContext";
import { useCustomers, invalidateSharedCustomersCache } from "@/hooks/useCustomers";
import { getPriceShaperConfigWarning } from "@/lib/customerServiceIntegrations";
import { canConfigureMerchantCenter } from "@/lib/internalUserAccess";
import { isDemoCustomerId } from "@/lib/demoCustomerId";
import PriceShaperSetupPanel from "@/components/price-shaper/PriceShaperSetupPanel";
import PriceShaperSetupExternalPanel from "@/components/price-shaper/PriceShaperSetupExternalPanel";
import PriceIndexDistributionChart from "@/components/price-shaper/PriceIndexDistributionChart";
import InfoTip from "@/components/price-shaper/InfoTip";
import PriceIndexScoreScale from "@/components/price-shaper/PriceIndexScoreScale";
import { PRICE_INDEX_TOOLTIPS } from "@/components/price-shaper/priceIndexTooltips";

const PRODUCTS_PAGE_SIZE = 10;

function normalizeOauthSlot(value) {
    const n = Number(value);
    if (n === 0) return 0;
    if (n === 2) return 2;
    return 1;
}

function formatMoney(value, currencyCode = "DKK") {
    if (value == null || !Number.isFinite(value)) return "—";
    const formatted = Number(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const suffix =
        currencyCode === "DKK"
            ? " DKK"
            : currencyCode === "NOK"
              ? " NOK"
              : currencyCode === "SEK"
                ? " SEK"
                : ` ${currencyCode}`;
    if (value >= 1000) {
        const thousands = value / 1000;
        return `${thousands.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K${suffix}`;
    }
    return `${formatted}${suffix}`;
}

function DistributionBar({ cheaperPct, similarPct, expensivePct, className = "" }) {
    const total = cheaperPct + similarPct + expensivePct;
    const normalize = (pct) => (total > 0 ? (pct / total) * 100 : 0);
    const cheaper = normalize(cheaperPct);
    const similar = normalize(similarPct);
    const expensive = normalize(expensivePct);

    return (
        <div className={`apex-ps-dist-bar ${className}`.trim()} role="img" aria-hidden>
            {cheaper > 0 ? (
                <span
                    className="apex-ps-dist-bar__seg is-cheaper"
                    style={{ width: `${cheaper}%` }}
                    title={`${cheaperPct}% cheaper`}
                />
            ) : null}
            {similar > 0 ? (
                <span
                    className="apex-ps-dist-bar__seg is-similar"
                    style={{ width: `${similar}%` }}
                    title={`${similarPct}% similar`}
                />
            ) : null}
            {expensive > 0 ? (
                <span
                    className="apex-ps-dist-bar__seg is-expensive"
                    style={{ width: `${expensive}%` }}
                    title={`${expensivePct}% more expensive`}
                />
            ) : null}
        </div>
    );
}

function DistributionLegend() {
    return (
        <div className="apex-ps-legend">
            <span className="apex-ps-legend__item">
                <span className="apex-ps-legend__swatch is-cheaper" aria-hidden />
                cheaper
                <InfoTip text={PRICE_INDEX_TOOLTIPS.cheaper} label="Cheaper explained" />
            </span>
            <span className="apex-ps-legend__item">
                <span className="apex-ps-legend__swatch is-similar" aria-hidden />
                similar
                <InfoTip text={PRICE_INDEX_TOOLTIPS.similar} label="Similar explained" />
            </span>
            <span className="apex-ps-legend__item">
                <span className="apex-ps-legend__swatch is-expensive" aria-hidden />
                more expensive
                <InfoTip text={PRICE_INDEX_TOOLTIPS.expensive} label="More expensive explained" />
            </span>
        </div>
    );
}

function PriceIndexScoreCard({ score, label, details }) {
    const tone =
        score == null
            ? "is-neutral"
            : score >= 60
              ? "is-good"
              : score >= 45
                ? "is-mid"
                : "is-low";

    const vsBenchmark = details?.avgVsBenchmarkPct;

    return (
        <article className="apex-ps-card apex-ps-card--score">
            <header className="apex-ps-card__header">
                <h2 className="apex-ps-card__title">
                    How is your price index?
                    <InfoTip text={PRICE_INDEX_TOOLTIPS.score} label="Price index score explained" />
                </h2>
                <p className="apex-ps-card__desc">
                    A score from 1–100 based on your product prices compared to Google benchmark
                    prices. 50 is at market level; higher means you are priced more competitively.
                </p>
            </header>
            <div className={`apex-ps-score ${tone}`}>
                <div className="apex-ps-score__visual">
                    <span className="apex-ps-score__value">{score ?? "—"}</span>
                    <span className="apex-ps-score__label">{label || "No data"}</span>
                    <PriceIndexScoreScale score={score} />
                </div>
            </div>
            {details ? (
                <div className="apex-ps-score__calc">
                    <p className="apex-ps-score__example">
                        We compared {details.productCount.toLocaleString("en-US")} of your products
                        to Google&apos;s benchmark prices for the same items.
                        {vsBenchmark != null && vsBenchmark > 100
                            ? ` On average, you are priced ${Math.round((vsBenchmark - 100) * 10) / 10}% higher than the benchmark.`
                            : vsBenchmark != null && vsBenchmark < 100
                              ? ` On average, you are priced ${Math.round((100 - vsBenchmark) * 10) / 10}% lower than the benchmark.`
                              : vsBenchmark != null
                                ? " On average, your prices match the benchmark."
                                : ""}
                    </p>
                    <p className="apex-ps-score__example">
                        The score puts that into a single number from 1–100: <strong>50</strong> means
                        you are roughly in line with the market, <strong>higher</strong> means you are
                        generally cheaper than competitors, and <strong>lower</strong> means you are
                        generally more expensive.
                    </p>
                </div>
            ) : null}
        </article>
    );
}

function BenchmarkSummaryCard({ summary, chartMode, onChartModeChange }) {
    const cheaperPct = summary?.cheaperPct ?? 0;
    const similarPct = summary?.similarPct ?? 0;
    const expensivePct = summary?.expensivePct ?? 0;

    return (
        <article className="apex-ps-card">
            <header className="apex-ps-card__header apex-ps-card__header--split">
                <div>
                    <h2 className="apex-ps-card__title">Your prices compared to the benchmark</h2>
                    <p className="apex-ps-card__desc">
                        Assess the price level of your products compared to prices on Google.
                    </p>
                </div>
                <div className="apex-ps-chart-toggle" role="tablist" aria-label="Chart type">
                    <button
                        type="button"
                        role="tab"
                        className={`apex-ps-chart-toggle__btn${chartMode === "bar" ? " is-active" : ""}`}
                        aria-selected={chartMode === "bar"}
                        onClick={() => onChartModeChange("bar")}
                    >
                        Bar
                    </button>
                    <button
                        type="button"
                        role="tab"
                        className={`apex-ps-chart-toggle__btn${chartMode === "pie" ? " is-active" : ""}`}
                        aria-selected={chartMode === "pie"}
                        onClick={() => onChartModeChange("pie")}
                    >
                        Pie
                    </button>
                </div>
            </header>

            <div className="apex-ps-metric-row">
                <span className="apex-ps-metric-label">
                    Products with benchmark
                    <InfoTip
                        text={PRICE_INDEX_TOOLTIPS.productsWithBenchmark}
                        label="Products with benchmark explained"
                    />
                </span>
                <span className="apex-ps-metric-value">{summary?.productCountLabel || "0"}</span>
            </div>

            {chartMode === "pie" ? (
                <PriceIndexDistributionChart
                    cheaperPct={cheaperPct}
                    similarPct={similarPct}
                    expensivePct={expensivePct}
                />
            ) : (
                <>
                    <DistributionBar
                        cheaperPct={cheaperPct}
                        similarPct={similarPct}
                        expensivePct={expensivePct}
                    />
                    <div className="apex-ps-pct-labels">
                        <span>{cheaperPct}% cheaper</span>
                        <span>{similarPct}% similar</span>
                        <span>{expensivePct}% more expensive</span>
                    </div>
                    <DistributionLegend />
                </>
            )}
        </article>
    );
}

function TopCompetitorsCard({ competitors }) {
    return (
        <article className="apex-ps-card">
            <header className="apex-ps-card__header">
                <h2 className="apex-ps-card__title">Top 5 competitors</h2>
                <p className="apex-ps-card__desc">
                    Retailers with the highest page overlap against your assortment in your main
                    Google product categories.
                </p>
            </header>

            <div className="apex-ps-brand-table-wrap">
                <table className="apex-ps-brand-table">
                    <thead>
                        <tr>
                            <th scope="col">#</th>
                            <th scope="col">Domain</th>
                            <th scope="col" className="is-num">
                                <span className="apex-ps-th-label">
                                    Page overlap
                                    <InfoTip
                                        text={PRICE_INDEX_TOOLTIPS.pageOverlap}
                                        label="Page overlap explained"
                                    />
                                </span>
                            </th>
                            <th scope="col" className="is-num">
                                <span className="apex-ps-th-label">
                                    Relative visibility
                                    <InfoTip
                                        text={PRICE_INDEX_TOOLTIPS.relativeVisibility}
                                        label="Relative visibility explained"
                                    />
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {(competitors || []).length === 0 ? (
                            <tr>
                                <td colSpan={4} className="apex-ps-empty-cell">
                                    No competitor overlap data available for your categories yet.
                                </td>
                            </tr>
                        ) : (
                            competitors.map((row) => (
                                <tr key={row.domain}>
                                    <td className="is-rank">{row.rank}</td>
                                    <td className="is-brand">
                                        <span className="apex-ps-competitor-domain">{row.domain}</span>
                                        {row.categoryLabel ? (
                                            <span className="apex-ps-competitor-category">
                                                {row.categoryLabel}
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="is-num">{row.pageOverlapPct}%</td>
                                    <td className="is-num">{row.relativeVisibilityPct}%</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </article>
    );
}

function BrandComparisonCard({ brands }) {
    return (
        <article className="apex-ps-card">
            <header className="apex-ps-card__header">
                <h2 className="apex-ps-card__title">Price comparison for your brands</h2>
                <p className="apex-ps-card__desc">
                    Assess the price level of your most popular brands compared to prices on Google.
                </p>
            </header>

            <div className="apex-ps-brand-table-wrap">
                <table className="apex-ps-brand-table">
                    <thead>
                        <tr>
                            <th scope="col">Brand</th>
                            <th scope="col">Price distribution</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(brands || []).length === 0 ? (
                            <tr>
                                <td colSpan={2} className="apex-ps-empty-cell">
                                    No brand data available yet.
                                </td>
                            </tr>
                        ) : (
                            brands.map((row) => (
                                <tr key={row.brand}>
                                    <td className="is-brand">{row.brand}</td>
                                    <td>
                                        <DistributionBar
                                            cheaperPct={row.cheaperPct}
                                            similarPct={row.similarPct}
                                            expensivePct={row.expensivePct}
                                            className="is-compact"
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </article>
    );
}

const PRODUCT_SORT_OPTIONS = [
    { value: "clicks_desc", label: "Clicks (high to low)" },
    { value: "title_asc", label: "Title (A–Z)" },
    { value: "your_price_asc", label: "Your price (low to high)" },
    { value: "your_price_desc", label: "Your price (high to low)" },
    { value: "benchmark_asc", label: "Benchmark (low to high)" },
    { value: "suggested_asc", label: "Suggested price (low to high)" },
    { value: "gap_desc", label: "Largest price gap" },
];

const PRODUCT_FILTER_OPTIONS = [
    { value: "all", label: "All products" },
    { value: "above_benchmark", label: "Above benchmark" },
    { value: "below_benchmark", label: "Below benchmark" },
    { value: "has_suggested", label: "Has suggested price" },
];

function sortProducts(list, sortKey) {
    const items = [...list];
    switch (sortKey) {
        case "title_asc":
            return items.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
        case "your_price_asc":
            return items.sort((a, b) => (a.yourPrice ?? 0) - (b.yourPrice ?? 0));
        case "your_price_desc":
            return items.sort((a, b) => (b.yourPrice ?? 0) - (a.yourPrice ?? 0));
        case "benchmark_asc":
            return items.sort((a, b) => (a.benchmarkPrice ?? 0) - (b.benchmarkPrice ?? 0));
        case "suggested_asc":
            return items.sort((a, b) => {
                const aVal = a.suggestedPrice ?? Number.POSITIVE_INFINITY;
                const bVal = b.suggestedPrice ?? Number.POSITIVE_INFINITY;
                return aVal - bVal;
            });
        case "gap_desc":
            return items.sort((a, b) => {
                const gapA = Math.abs((a.yourPrice ?? 0) - (a.benchmarkPrice ?? 0));
                const gapB = Math.abs((b.yourPrice ?? 0) - (b.benchmarkPrice ?? 0));
                return gapB - gapA;
            });
        case "clicks_desc":
        default:
            return items.sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));
    }
}

function filterProducts(list, filterKey) {
    switch (filterKey) {
        case "above_benchmark":
            return list.filter(
                (p) =>
                    Number.isFinite(p.yourPrice) &&
                    Number.isFinite(p.benchmarkPrice) &&
                    p.yourPrice > p.benchmarkPrice
            );
        case "below_benchmark":
            return list.filter(
                (p) =>
                    Number.isFinite(p.yourPrice) &&
                    Number.isFinite(p.benchmarkPrice) &&
                    p.yourPrice < p.benchmarkPrice
            );
        case "has_suggested":
            return list.filter((p) => Number.isFinite(p.suggestedPrice));
        case "all":
        default:
            return list;
    }
}

function matchesProductSearch(product, query) {
    if (!query) return true;
    const haystack = [product.title, product.brand, product.offerId, product.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return haystack.includes(query);
}

function PopularProductsCard({
    products,
    totalProductCount,
    productsTruncated,
    currencyCode,
    onLoadAll,
    loadingAll,
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortKey, setSortKey] = useState("clicks_desc");
    const [filterKey, setFilterKey] = useState("all");
    const [page, setPage] = useState(1);

    const sourceList = products ?? [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const visibleProducts = useMemo(() => {
        const filtered = filterProducts(sourceList, filterKey).filter((product) =>
            matchesProductSearch(product, normalizedSearch)
        );
        return sortProducts(filtered, sortKey);
    }, [sourceList, filterKey, normalizedSearch, sortKey]);

    const totalPages = Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageStart = (currentPage - 1) * PRODUCTS_PAGE_SIZE;
    const pagedProducts = visibleProducts.slice(pageStart, pageStart + PRODUCTS_PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, sortKey, filterKey, sourceList.length]);

    const catalogTotal = totalProductCount ?? sourceList.length;

    return (
        <article className="apex-ps-card apex-ps-card--wide">
            <header className="apex-ps-card__header">
                <h2 className="apex-ps-card__title">
                    Your most popular products with price comparisons
                    <InfoTip
                        text={PRICE_INDEX_TOOLTIPS.benchmark}
                        label="Product price comparisons explained"
                    />
                </h2>
                <p className="apex-ps-card__desc">
                    Identify your most popular products with a difference between your price and
                    the Google price benchmark.
                </p>
            </header>

            {productsTruncated ? (
                <p className="apex-ps-table-truncated-note">
                    Showing the top {sourceList.length.toLocaleString("en-US")} products by clicks
                    out of {catalogTotal.toLocaleString("en-US")} total. Search and filters apply
                    to loaded products only.
                </p>
            ) : null}

            <div className="apex-ps-table-toolbar">
                <label className="apex-ps-table-search">
                    <FiSearch className="apex-ps-table-search__icon" aria-hidden />
                    <input
                        type="search"
                        className="apex-ps-table-search__input"
                        placeholder="Search by title, brand, or product ID…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </label>
                <div className="apex-ps-table-controls">
                    <label className="apex-ps-table-control">
                        <span className="apex-ps-table-control__label">Filter</span>
                        <select
                            className="apex-ps-table-control__select"
                            value={filterKey}
                            onChange={(e) => setFilterKey(e.target.value)}
                        >
                            {PRODUCT_FILTER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="apex-ps-table-control">
                        <span className="apex-ps-table-control__label">Sort by</span>
                        <select
                            className="apex-ps-table-control__select"
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value)}
                        >
                            {PRODUCT_SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {productsTruncated ? (
                        <button
                            type="button"
                            className="apex-ps-load-all-btn"
                            onClick={onLoadAll}
                            disabled={loadingAll}
                        >
                            {loadingAll ? "Loading all products…" : `Load all ${catalogTotal.toLocaleString("en-US")} products`}
                        </button>
                    ) : null}
                </div>
            </div>

            <p className="apex-ps-table-meta">
                Showing {visibleProducts.length.toLocaleString("en-US")} of{" "}
                {sourceList.length.toLocaleString("en-US")} loaded products
                {productsTruncated
                    ? ` (${catalogTotal.toLocaleString("en-US")} total in catalog)`
                    : ""}
            </p>

            <div className="apex-ps-product-table-wrap">
                <table className="apex-ps-product-table">
                    <thead>
                        <tr>
                            <th scope="col">Image</th>
                            <th scope="col">Title</th>
                            <th scope="col" className="is-num">
                                <span className="apex-ps-th-label">
                                    Your price
                                    <InfoTip text={PRICE_INDEX_TOOLTIPS.yourPrice} label="Your price explained" />
                                </span>
                            </th>
                            <th scope="col" className="is-num">
                                <span className="apex-ps-th-label">
                                    Benchmark
                                    <InfoTip text={PRICE_INDEX_TOOLTIPS.benchmark} label="Benchmark explained" />
                                </span>
                            </th>
                            <th scope="col" className="is-num">
                                <span className="apex-ps-th-label">
                                    Suggested price
                                    <InfoTip
                                        text={PRICE_INDEX_TOOLTIPS.suggestedPrice}
                                        label="Suggested price explained"
                                    />
                                </span>
                            </th>
                            <th scope="col" className="is-num">
                                <span className="apex-ps-th-label">
                                    Clicks
                                    <InfoTip text={PRICE_INDEX_TOOLTIPS.clicks} label="Clicks explained" />
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedProducts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="apex-ps-empty-cell">
                                    {sourceList.length === 0
                                        ? "No products with price comparison data available."
                                        : "No products match your search or filters."}
                                </td>
                            </tr>
                        ) : (
                            pagedProducts.map((product) => (
                                <tr key={product.id || product.offerId}>
                                    <td className="is-image">
                                        {product.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={product.imageUrl}
                                                alt=""
                                                className="apex-ps-product-thumb"
                                            />
                                        ) : (
                                            <span className="apex-ps-product-thumb is-placeholder" />
                                        )}
                                    </td>
                                    <td className="is-title">
                                        <span className="apex-ps-product-title">{product.title}</span>
                                        {product.brand ? (
                                            <span className="apex-ps-product-brand">{product.brand}</span>
                                        ) : null}
                                    </td>
                                    <td className="is-num">
                                        {formatMoney(product.yourPrice, currencyCode)}
                                    </td>
                                    <td className="is-num">
                                        {formatMoney(product.benchmarkPrice, currencyCode)}
                                    </td>
                                    <td className="is-num">
                                        {formatMoney(product.suggestedPrice, currencyCode)}
                                    </td>
                                    <td className="is-num">{product.clicks ?? 0}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {visibleProducts.length > PRODUCTS_PAGE_SIZE ? (
                <div className="apex-ps-pagination">
                    <span className="apex-ps-pagination__info">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="apex-ps-pagination__actions">
                        <button
                            type="button"
                            className="apex-ps-pagination__btn"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            className="apex-ps-pagination__btn"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                        >
                            Next
                        </button>
                    </div>
                </div>
            ) : null}
        </article>
    );
}

function AdminAccessibleAccounts({ accessibleAccounts }) {
    return (
        <div className="apex-ps-access-list">
            <p>Accounts visible to OAuth slot 0 (Google Ads):</p>
            <ul>
                {(accessibleAccounts.slot0 || []).length === 0 ? (
                    <li>None (or credentials missing)</li>
                ) : (
                    accessibleAccounts.slot0.map((account) => (
                        <li key={`s0-${account.id}`}>
                            {account.id}
                            {account.accountName ? ` — ${account.accountName}` : ""}
                            {account.matchesTarget ? " ✓" : ""}
                        </li>
                    ))
                )}
            </ul>
            <p>Accounts visible to OAuth slot 1 (MC1):</p>
            <ul>
                {(accessibleAccounts.slot1 || []).length === 0 ? (
                    <li>None (or credentials missing)</li>
                ) : (
                    accessibleAccounts.slot1.map((account) => (
                        <li key={`s1-${account.id}`}>
                            {account.id}
                            {account.accountName ? ` — ${account.accountName}` : ""}
                            {account.matchesTarget ? " ✓" : ""}
                        </li>
                    ))
                )}
            </ul>
            <p>Accounts visible to OAuth slot 2 (MC2):</p>
            <ul>
                {(accessibleAccounts.slot2 || []).length === 0 ? (
                    <li>None (or credentials missing)</li>
                ) : (
                    accessibleAccounts.slot2.map((account) => (
                        <li key={`s2-${account.id}`}>
                            {account.id}
                            {account.accountName ? ` — ${account.accountName}` : ""}
                            {account.matchesTarget ? " ✓" : ""}
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}

export default function PriceShaperClient() {
    const { customerId } = useParams();
    const user = useUser();
    const { customers, fetchCustomers } = useCustomers();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [benchmarkChartMode, setBenchmarkChartMode] = useState("bar");
    const [setupId, setSetupId] = useState("");
    const [setupSlot, setSetupSlot] = useState(1);
    const [savingSetup, setSavingSetup] = useState(false);
    const [setupError, setSetupError] = useState(null);
    const [loadingAllProducts, setLoadingAllProducts] = useState(false);
    const isAdmin = user?.isAdmin === true;
    const canConfigureMc = canConfigureMerchantCenter(user);

    const activeCustomer = useMemo(
        () => customers.find((c) => String(c._id) === String(customerId)) || null,
        [customers, customerId]
    );

    const isDemo = isDemoCustomerId(customerId);

    const configMissing = useMemo(
        () => !isDemo && getPriceShaperConfigWarning(activeCustomer?.CustomerSettings),
        [activeCustomer, isDemo]
    );

    useEffect(() => {
        const settings = activeCustomer?.CustomerSettings;
        if (!settings) return;
        setSetupId(settings.googleMerchantCenterId || "");
        setSetupSlot(normalizeOauthSlot(settings.googleMerchantAccountSlot ?? 1));
    }, [activeCustomer]);

    const loadData = useCallback(
        async ({ force = false, includeAllProducts = false } = {}) => {
            if (!customerId) return;
            if (configMissing && !force) {
                setLoading(false);
                setData(null);
                setError(null);
                return;
            }
            if (includeAllProducts) {
                setLoadingAllProducts(true);
            } else {
                setLoading(true);
            }
            setError(null);
            try {
                const query = includeAllProducts ? "?products=all" : "";
                const res = await fetch(`/api/price-index/${customerId}${query}`);
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (json.code === "NOT_CONFIGURED") {
                        setData(null);
                        setError(null);
                        return;
                    }
                    setError({
                        message: json.error || "Could not load Price Index data",
                        code: json.code || null,
                        accessibleAccounts: json.accessibleAccounts || null,
                        configuredSlot: json.configuredSlot,
                        merchantAccountId: json.merchantAccountId,
                    });
                    if (!includeAllProducts) {
                        setData(null);
                    }
                    return;
                }
                setData(json);
                setError(null);
            } catch (err) {
                setError({
                    message: err.message || "Could not load Price Index data",
                });
                if (!includeAllProducts) {
                    setData(null);
                }
            } finally {
                if (includeAllProducts) {
                    setLoadingAllProducts(false);
                } else {
                    setLoading(false);
                }
            }
        },
        [customerId, configMissing]
    );

    const handleLoadAllProducts = useCallback(() => {
        loadData({ force: true, includeAllProducts: true });
    }, [loadData]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveSetup = async () => {
        setSavingSetup(true);
        setSetupError(null);
        try {
            const res = await fetch(`/api/price-index/${customerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    googleMerchantCenterId: setupId.trim(),
                    googleMerchantAccountSlot: setupSlot,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || "Failed to save Merchant Center settings");
            }
            invalidateSharedCustomersCache();
            await fetchCustomers();
            await loadData({ force: true });
        } catch (err) {
            setSetupError(err.message || "Failed to save Merchant Center settings");
        } finally {
            setSavingSetup(false);
        }
    };

    const showSetup = configMissing && !data?.demo;

    return (
        <div id="PriceShaperPage" className="apex-perf w-full apex-ps-page">
            <DashboardHeading
                title="Price Index"
                subtitle="Price comparison against Google Merchant Center benchmarks"
                right={
                    !showSetup ? (
                        <button
                            type="button"
                            className="apex-ps-refresh-btn"
                            onClick={() => loadData({ force: true })}
                            disabled={loading}
                        >
                            <FiRefreshCw className={loading ? "is-spinning" : ""} aria-hidden />
                            Refresh
                        </button>
                    ) : null
                }
            />

            {showSetup ? (
                canConfigureMc ? (
                    <PriceShaperSetupPanel
                        customerId={customerId}
                        merchantCenterId={setupId}
                        oauthSlot={setupSlot}
                        onMerchantCenterIdChange={setSetupId}
                        onOauthSlotChange={setSetupSlot}
                        onSave={handleSaveSetup}
                        saving={savingSetup}
                        error={setupError}
                    />
                ) : (
                    <PriceShaperSetupExternalPanel />
                )
            ) : null}

            {!showSetup && error ? (
                <div className="apex-ps-alert is-error">
                    <p>{error.message}</p>
                    {isAdmin && error.accessibleAccounts ? (
                        <AdminAccessibleAccounts accessibleAccounts={error.accessibleAccounts} />
                    ) : null}
                </div>
            ) : !showSetup && loading && !data ? (
                <div className="apex-ps-loader">
                    <CobaltLoader />
                </div>
            ) : !showSetup ? (
                <div className="apex-ps-grid">
                    <PriceIndexScoreCard
                        score={data?.priceIndexScore}
                        label={data?.priceIndexLabel}
                        details={data?.priceIndexDetails}
                    />
                    <BenchmarkSummaryCard
                        summary={data?.summary}
                        chartMode={benchmarkChartMode}
                        onChartModeChange={setBenchmarkChartMode}
                    />
                    <BrandComparisonCard brands={data?.brands} />
                    <TopCompetitorsCard competitors={data?.topCompetitors} />
                    <PopularProductsCard
                        products={data?.products ?? data?.allProducts}
                        totalProductCount={data?.totalProductCount}
                        productsTruncated={data?.productsTruncated}
                        currencyCode={data?.currencyCode}
                        onLoadAll={handleLoadAllProducts}
                        loadingAll={loadingAllProducts}
                    />
                </div>
            ) : null}

            {data?.performanceRange ? (
                <p className="apex-ps-meta">
                    Click data: {data.performanceRange.startDate} – {data.performanceRange.endDate}
                    {data.reportCountryCode ? ` · Country: ${data.reportCountryCode}` : ""}
                    {data.demo ? " · Demo" : ""}
                </p>
            ) : null}
        </div>
    );
}
