"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { FiHelpCircle, FiRefreshCw, FiSearch } from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useUser } from "@/contexts/UserContext";
import { useCustomers, invalidateSharedCustomersCache } from "@/hooks/useCustomers";
import { getPriceShaperConfigWarning } from "@/lib/customerServiceIntegrations";
import PriceShaperSetupPanel from "@/components/price-shaper/PriceShaperSetupPanel";
import PriceIndexDistributionChart from "@/components/price-shaper/PriceIndexDistributionChart";

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
            </span>
            <span className="apex-ps-legend__item">
                <span className="apex-ps-legend__swatch is-similar" aria-hidden />
                similar
            </span>
            <span className="apex-ps-legend__item">
                <span className="apex-ps-legend__swatch is-expensive" aria-hidden />
                more expensive
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
                <h2 className="apex-ps-card__title">How is your price index?</h2>
                <p className="apex-ps-card__desc">
                    A score from 1–100 based on your product prices compared to Google benchmark
                    prices. 50 is at market level; higher means you are priced more competitively.
                </p>
            </header>
            <div className={`apex-ps-score ${tone}`}>
                <span className="apex-ps-score__value">{score ?? "—"}</span>
                <span className="apex-ps-score__label">{label || "No data"}</span>
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
                    <FiHelpCircle className="apex-ps-help-icon" aria-hidden />
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
                                Page overlap
                            </th>
                            <th scope="col" className="is-num">
                                Relative visibility
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

function PopularProductsCard({ allProducts, currencyCode }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortKey, setSortKey] = useState("clicks_desc");
    const [filterKey, setFilterKey] = useState("all");

    const sourceList = allProducts ?? [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const visibleProducts = useMemo(() => {
        const filtered = filterProducts(sourceList, filterKey).filter((product) =>
            matchesProductSearch(product, normalizedSearch)
        );
        return sortProducts(filtered, sortKey);
    }, [sourceList, filterKey, normalizedSearch, sortKey]);

    return (
        <article className="apex-ps-card apex-ps-card--wide">
            <header className="apex-ps-card__header">
                <h2 className="apex-ps-card__title">
                    Your most popular products with price comparisons
                </h2>
                <p className="apex-ps-card__desc">
                    Identify your most popular products with a difference between your price and
                    the Google price benchmark.
                </p>
            </header>

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
                </div>
            </div>

            <p className="apex-ps-table-meta">
                Showing {visibleProducts.length.toLocaleString("en-US")} of{" "}
                {sourceList.length.toLocaleString("en-US")} products
            </p>

            <div className="apex-ps-product-table-wrap">
                <table className="apex-ps-product-table">
                    <thead>
                        <tr>
                            <th scope="col">Image</th>
                            <th scope="col">Title</th>
                            <th scope="col" className="is-num">
                                Your price
                            </th>
                            <th scope="col" className="is-num">
                                Benchmark
                            </th>
                            <th scope="col" className="is-num">
                                Suggested price
                            </th>
                            <th scope="col" className="is-num">
                                Clicks
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleProducts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="apex-ps-empty-cell">
                                    {sourceList.length === 0
                                        ? "No products with price comparison data available."
                                        : "No products match your search or filters."}
                                </td>
                            </tr>
                        ) : (
                            visibleProducts.map((product) => (
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
    const isAdmin = user?.isAdmin === true;

    const activeCustomer = useMemo(
        () => customers.find((c) => String(c._id) === String(customerId)) || null,
        [customers, customerId]
    );

    const configMissing = useMemo(
        () => getPriceShaperConfigWarning(activeCustomer?.CustomerSettings),
        [activeCustomer]
    );

    useEffect(() => {
        const settings = activeCustomer?.CustomerSettings;
        if (!settings) return;
        setSetupId(settings.googleMerchantCenterId || "");
        setSetupSlot(normalizeOauthSlot(settings.googleMerchantAccountSlot ?? 1));
    }, [activeCustomer]);

    const loadData = useCallback(
        async ({ force = false } = {}) => {
            if (!customerId) return;
            if (configMissing && !force) {
                setLoading(false);
                setData(null);
                setError(null);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/price-shaper/${customerId}`);
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
                    setData(null);
                    return;
                }
                setData(json);
                setError(null);
            } catch (err) {
                setError({
                    message: err.message || "Could not load Price Index data",
                });
                setData(null);
            } finally {
                setLoading(false);
            }
        },
        [customerId, configMissing]
    );

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveSetup = async () => {
        setSavingSetup(true);
        setSetupError(null);
        try {
            const res = await fetch(`/api/price-shaper/${customerId}`, {
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
                        allProducts={data?.allProducts}
                        currencyCode={data?.currencyCode}
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
