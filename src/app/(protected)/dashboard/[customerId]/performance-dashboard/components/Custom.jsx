"use client";

import React, { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { FiPlus, FiEdit2, FiTrash2, FiRepeat } from "react-icons/fi";
import ReplaceStandardMetricModal from "./ReplaceStandardMetricModal";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import AddKpiModal from "./AddKpiModal";
import {
    FiDollarSign,
    FiTrendingUp,
    FiShoppingCart,
    FiCreditCard,
    FiBarChart2,
    FiPieChart,
    FiShoppingBag,
    FiUserCheck,
} from "react-icons/fi";
import {
    evaluateFormula,
    getFirstMetricKey,
    toParts,
} from "./kpiFormulaUtils";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";
import { aggregateShopifyAndAdSpendByPeriodFromRows } from "@/lib/mergeAdSpendDaily";
import {
    COMPARISON_METHOD,
    getComparisonMethodLabel,
    resolveChartCategoryPrevKey,
} from "@/lib/dateRangeComparison";

const fmt = (n, decimals = 0) =>
    (n ?? 0).toLocaleString("da-DK", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
    });

const STORAGE_KEY_PREFIX = "performance-dashboard-custom-kpis";
const MIGRATION_KEY = "performance-dashboard-custom-kpis-migrated";

const METRIC_ICONS = {
    total_sales: FiDollarSign,
    revenue: FiDollarSign,
    net_sales: FiDollarSign,
    gross_sales: FiDollarSign,
    discounts: FiDollarSign,
    duties: FiDollarSign,
    additional_fees: FiDollarSign,
    shipping_revenue: FiDollarSign,
    tax: FiDollarSign,
    gross_profit: FiDollarSign,
    orders: FiShoppingCart,
    returns: FiTrendingUp,
    cost: FiCreditCard,
    meta_spend: FiCreditCard,
    google_spend: FiCreditCard,
    pinterest_spend: FiCreditCard,
    snapchat_spend: FiCreditCard,
    bing_spend: FiCreditCard,
    reddit_spend: FiCreditCard,
    roas: FiBarChart2,
    poas: FiPieChart,
    aov: FiShoppingBag,
    cac: FiUserCheck,
    spendshare: FiBarChart2,
};

// Fictional fallback values when real data is not available
const FICTIONAL_METRICS = {
    total_sales: 125000,
    revenue: 118000,
    gross_profit: 42000,
    orders: 850,
    returns: 3200,
    cost: 18500,
    roas: 6.38,
    poas: 2.27,
    aov: 139,
    cac: 22,
    spendshare: 0.157,
};

const CURRENCY_KEYS = [
    "total_sales",
    "revenue",
    "net_sales",
    "gross_sales",
    "discounts",
    "duties",
    "additional_fees",
    "shipping_revenue",
    "tax",
    "gross_profit",
    "returns",
    "cost",
    "meta_spend",
    "google_spend",
    "pinterest_spend",
    "snapchat_spend",
    "bing_spend",
    "reddit_spend",
    "aov",
    "cac",
];
const RATIO_KEYS = ["roas", "poas", "spendshare"];

/** Custom tab uses store-reported Shopify metrics (no returns % override in calcs). */
const STORE_REPORTED_METRIC_KEYS = new Set([
    "net_sales",
    "revenue",
    "returns",
    "gross_sales",
    "discounts",
    "total_sales",
    "shipping_revenue",
    "duties",
    "additional_fees",
    "tax",
]);

function formatValue(value, kpi) {
    if (value === null || value === undefined || isNaN(value)) return "-";

    const parts = toParts(kpi);
    const metricKeys = parts
        ? parts.filter((p) => p.type === "metric").map((p) => p.value)
        : [kpi.metricA, kpi.metricB].filter(Boolean);
    if (metricKeys.length === 0) {
        return typeof value === "number" ? value.toLocaleString("da-DK", { maximumFractionDigits: 2 }) : String(value);
    }
    const firstMetric = metricKeys[0];
    const lastMetric = metricKeys[metricKeys.length - 1];
    const isCurrency =
        metricKeys.some((k) => CURRENCY_KEYS.includes(k)) ||
        Math.abs(value) >= 100;
    const isRatio = metricKeys.some((k) => RATIO_KEYS.includes(k));

    if (
        (firstMetric === "revenue" || firstMetric === "total_sales") &&
        lastMetric === "orders"
    ) {
        return value.toLocaleString("da-DK", {
            style: "currency",
            currency: "DKK",
            maximumFractionDigits: 0,
        });
    }
    if (isRatio) {
        return value.toLocaleString("da-DK", {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
        });
    }
    if (isCurrency) {
        return value.toLocaleString("da-DK", {
            style: "currency",
            currency: "DKK",
            maximumFractionDigits: 0,
        });
    }
    return value.toLocaleString("da-DK", { maximumFractionDigits: 2 });
}

async function fetchKpisFromApi(customerId) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${baseUrl}/api/custom-kpis/${customerId}`);
    if (!res.ok) throw new Error("Failed to fetch custom KPIs");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function loadKpisFromStorage(customerId) {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${customerId}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export default function Custom({
    customerId = "",
    metricsData = null,
    metrics = [],
    shopifyDaily = [],
    shopifyDailyPrev = [],
    adChannelRowsCurr = {},
    adChannelRowsPrev = {},
    appliedDateRange = { startDate: "", endDate: "" },
    comparisonMethod = "Last Year",
    aggregateBy = "period",
    chartColors = {},
    visibleSpendMetricKeys,
    onKpisUpdated,
}) {
    const [kpis, setKpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingKpi, setEditingKpi] = useState(null);
    const [selectedKpis, setSelectedKpis] = useState([]);
    const [replaceModalKpi, setReplaceModalKpi] = useState(null);

    useEffect(() => {
        if (!customerId) {
            setKpis([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchKpisFromApi(customerId)
            .then(async (apiKpis) => {
                if (cancelled) return;
                if (apiKpis.length === 0) {
                    const stored = loadKpisFromStorage(customerId);
                    const migrated = typeof window !== "undefined" && localStorage.getItem(`${MIGRATION_KEY}-${customerId}`);
                    if (stored.length > 0 && !migrated) {
                        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
                        const migratedKpis = [];
                        for (const kpi of stored) {
                            const { id, ...rest } = kpi;
                            const res = await fetch(`${baseUrl}/api/custom-kpis/${customerId}`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(rest),
                            });
                            if (res.ok) migratedKpis.push(await res.json());
                        }
                        localStorage.removeItem(`${STORAGE_KEY_PREFIX}-${customerId}`);
                        localStorage.setItem(`${MIGRATION_KEY}-${customerId}`, "1");
                        return migratedKpis;
                    }
                }
                return apiKpis;
            })
            .then((data) => {
                if (!cancelled) setKpis(data);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [customerId]);

    useEffect(() => {
        setSelectedKpis((prev) => {
            const ids = kpis.map((k) => k.id);
            const kept = prev.filter((id) => ids.includes(id));
            if (kept.length === 0 && kpis.length > 0) {
                return [kpis[0].id];
            }
            return kept;
        });
    }, [kpis]);

    const handleSave = async (kpi) => {
        const isEdit = kpis.some((k) => k.id === kpi.id);
        setSaving(true);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
        try {
            if (isEdit) {
                const res = await fetch(
                    `${baseUrl}/api/custom-kpis/${customerId}/${kpi.id}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: kpi.name,
                            parts: kpi.parts || [],
                            metricA: kpi.metricA || "",
                            metricB: kpi.metricB || "",
                            operator: kpi.operator || "",
                        }),
                    }
                );
                if (!res.ok) throw new Error("Failed to update KPI");
                const updated = await res.json();
                setKpis((prev) =>
                    prev.map((k) => (k.id === kpi.id ? updated : k))
                );
                pushGTMEvent(GTM_EVENTS.PERFORMANCE_DASHBOARD_CUSTOM_KPI_SAVED, {
                    eventData: { customerId: String(customerId), action: "update" },
                });
                onKpisUpdated?.();
            } else {
                const res = await fetch(
                    `${baseUrl}/api/custom-kpis/${customerId}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: kpi.name,
                            parts: kpi.parts || [],
                            metricA: kpi.metricA || "",
                            metricB: kpi.metricB || "",
                            operator: kpi.operator || "",
                        }),
                    }
                );
                if (!res.ok) throw new Error("Failed to create KPI");
                const created = await res.json();
                setKpis((prev) => [...prev, created]);
                setSelectedKpis((p) => [...p, created.id]);
                pushGTMEvent(GTM_EVENTS.PERFORMANCE_DASHBOARD_CUSTOM_KPI_SAVED, {
                    eventData: { customerId: String(customerId), action: "create" },
                });
                onKpisUpdated?.();
            }
            setModalOpen(false);
            setEditingKpi(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (kpi) => {
        setEditingKpi(kpi);
        setModalOpen(true);
    };

    const handleDelete = async (kpi) => {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
        try {
            const res = await fetch(
                `${baseUrl}/api/custom-kpis/${customerId}/${kpi.id}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error("Failed to delete KPI");
            setKpis((prev) => prev.filter((k) => k.id !== kpi.id));
            setSelectedKpis((p) => p.filter((id) => id !== kpi.id));
            pushGTMEvent(GTM_EVENTS.PERFORMANCE_DASHBOARD_CUSTOM_KPI_DELETED, {
                eventData: { customerId: String(customerId), kpiId: String(kpi.id) },
            });
            onKpisUpdated?.();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSaveReplacement = async (metricKey) => {
        if (!replaceModalKpi) return;
        setSaving(true);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
        try {
            const res = await fetch(
                `${baseUrl}/api/custom-kpis/${customerId}/${replaceModalKpi.id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        replacesStandardMetricKey: metricKey,
                    }),
                }
            );
            if (!res.ok) throw new Error("Failed to update KPI");
            const updated = await res.json();
            setKpis((prev) =>
                prev.map((k) => {
                    if (k.id === updated.id) return updated;
                    if (metricKey && k.replacesStandardMetricKey === metricKey) {
                        return { ...k, replacesStandardMetricKey: null };
                    }
                    return k;
                })
            );
            setReplaceModalKpi(null);
            onKpisUpdated?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const takenReplacementKeys = kpis
        .filter((k) => k.replacesStandardMetricKey)
        .map((k) => k.replacesStandardMetricKey);

    const handleAddClick = () => {
        setEditingKpi(null);
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
        setEditingKpi(null);
    };

    const toggleKpiSelection = (kpiId) => {
        setSelectedKpis((prev) =>
            prev.includes(kpiId)
                ? prev.length > 1
                    ? prev.filter((id) => id !== kpiId)
                    : prev
                : [...prev, kpiId]
        );
    };

    /** Frozen store baseline only — never standard effective metrics (replacement / override). */
    const dataForCards = metricsData ?? FICTIONAL_METRICS;

    // Build chart series for custom KPIs
    const { chartSeries, chartOptions } = useMemo(() => {
        const keyFn =
            aggregateBy === "monthly"
                ? (p) => dayjs(p).format("YYYY-MM")
                : (p) => p;
        const currAgg = aggregateShopifyAndAdSpendByPeriodFromRows(
            shopifyDaily,
            adChannelRowsCurr,
            keyFn
        );
        const prevAgg = aggregateShopifyAndAdSpendByPeriodFromRows(
            shopifyDailyPrev,
            adChannelRowsPrev,
            keyFn
        );

        const categories = Object.keys(currAgg).sort();
        const sortedPrevKeys = Object.keys(prevAgg).sort();
        const comparisonLabel = getComparisonMethodLabel(comparisonMethod);

        const series = [];
        selectedKpis.forEach((kpiId) => {
            const kpi = kpis.find((k) => k.id === kpiId);
            if (!kpi) return;

            const currData = categories.map((k) => {
                const v = currAgg[k];
                const val = evaluateFormula(kpi, v);
                return val !== null ? Math.round(Number(val)) : null;
            });
            series.push({
                name: `${kpi.name} (Current)`,
                data: currData,
            });

            if (comparisonMethod !== COMPARISON_METHOD.NONE) {
                const prevData = categories.map((k, idx) => {
                    const prevKey = resolveChartCategoryPrevKey({
                        comparisonMethod,
                        categoryKey: k,
                        categoryIndex: idx,
                        aggregateBy,
                        appliedStartDate: appliedDateRange.startDate,
                        appliedEndDate: appliedDateRange.endDate,
                        sortedPrevKeys,
                    });
                    const v = prevAgg[prevKey];
                    const val = evaluateFormula(kpi, v);
                    return val !== null ? Math.round(Number(val)) : null;
                });
                series.push({
                    name: `${kpi.name} (${comparisonLabel})`,
                    data: prevData,
                });
            }
        });

        const formatChartValue = (v) =>
            typeof v === "number" && !isNaN(v)
                ? v.toLocaleString("da-DK", {
                      maximumFractionDigits: 0,
                      minimumFractionDigits: 0,
                  })
                : v;

        const options = {
            chart: {
                toolbar: { show: false },
                zoom: { enabled: false },
                fontFamily: "Inter, sans-serif",
            },
            xaxis: {
                categories,
                labels: {
                    style: { colors: chartColors.primaryLighter || "#406969" },
                },
                axisTicks: { show: true },
                axisBorder: { show: true },
            },
            yaxis: {
                labels: {
                    style: { colors: chartColors.primary || "#1E2B2B" },
                    formatter: formatChartValue,
                },
            },
            tooltip: {
                theme: "light",
                y: { formatter: formatChartValue },
            },
            colors: [
                chartColors.lime || "#C6ED62",
                "#94a3b8",
                chartColors.primaryLighter || "#406969",
                "#cbd5e1",
                chartColors.green || "#213834",
                "#f1f5f9",
            ],
            stroke: {
                width: series.map((_, i) => (i % 2 === 0 ? 2 : 1)),
                curve: "smooth",
                dashArray: series.map((_, i) => (i % 2 === 1 ? 5 : 0)),
            },
            fill: { type: "solid", opacity: [1, 0.5] },
            grid: {
                borderColor: "#e5e7eb",
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            dataLabels: { enabled: false },
            legend: {
                show: true,
                position: "top",
                labels: { colors: chartColors.primary || "#1E2B2B" },
            },
        };

        return { chartSeries: series, chartOptions: options };
    }, [
        kpis,
        selectedKpis,
        shopifyDaily,
        adChannelRowsCurr,
        shopifyDailyPrev,
        adChannelRowsPrev,
        appliedDateRange,
        comparisonMethod,
        aggregateBy,
        chartColors,
    ]);

    return (
        <div className="w-full">
            {error && (
                <div className="apex-perf-alert apex-perf-alert--error mb-4">
                    {error}
                </div>
            )}
            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="panel"
                        eyebrow="Custom KPIs"
                        title="Loading KPIs"
                        subtitle="Fetching your saved formulas and metric definitions."
                        steps={[
                            "Load custom KPIs",
                            "Evaluate formulas",
                            "Prepare chart series",
                        ]}
                        request="GET /api/custom-kpis"
                    />
                </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full">
                {kpis.map((kpi) => {
                    const rawValue = evaluateFormula(kpi, dataForCards);
                    const displayValue = formatValue(rawValue, kpi);
                    const Icon =
                        METRIC_ICONS[getFirstMetricKey(kpi)] || FiBarChart2;
                    const isSelected = selectedKpis.includes(kpi.id);
                    const parts = toParts(kpi);
                    const isSingleMetric =
                        parts?.length === 1 && parts[0]?.type === "metric";
                    const metricKey = isSingleMetric
                        ? parts[0].value
                        : getFirstMetricKey(kpi);
                    const standardMetric = metrics?.find(
                        (m) => m.key === metricKey
                    );

                    return (
                        <div
                            key={kpi.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleKpiSelection(kpi.id)}
                            onKeyDown={(e) =>
                                (e.key === "Enter" || e.key === " ") &&
                                toggleKpiSelection(kpi.id)
                            }
                            className="relative group cursor-pointer rounded-lg"
                            aria-pressed={isSelected}
                        >
                            <MetricCard
                                variant="cobalt"
                                label={kpi.name}
                                value={displayValue}
                                icon={
                                    <Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />
                                }
                                isActive={isSelected}
                                comparisonMethod={comparisonMethod}
                                change={
                                    isSingleMetric
                                        ? standardMetric?.change
                                        : undefined
                                }
                                changeType={
                                    isSingleMetric
                                        ? standardMetric?.changeType
                                        : undefined
                                }
                                changeAbsolute={
                                    isSingleMetric
                                        ? standardMetric?.changeAbsolute
                                        : undefined
                                }
                                changePrevValue={
                                    isSingleMetric
                                        ? standardMetric?.changePrevValue
                                        : undefined
                                }
                                popOverContent={
                                    isSingleMetric &&
                                    standardMetric?.popOverContent
                                        ? standardMetric.popOverContent
                                        : null
                                }
                            />
                            <div className="apex-perf-custom__hover-actions">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setReplaceModalKpi(kpi);
                                    }}
                                    className="apex-perf-icon-btn"
                                    aria-label="Replace standard metric"
                                    title="Replace standard metric"
                                >
                                    <FiRepeat className="text-sm" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleEdit(kpi);
                                    }}
                                    className="apex-perf-icon-btn"
                                    aria-label="Edit KPI"
                                >
                                    <FiEdit2 className="text-sm" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleDelete(kpi);
                                    }}
                                    className="apex-perf-icon-btn hover:text-[var(--color-error)]"
                                    aria-label="Delete KPI"
                                >
                                    <FiTrash2 className="text-sm" />
                                </button>
                            </div>
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={handleAddClick}
                    className="group apex-perf-custom__add"
                    aria-label="Add KPI"
                >
                    <FiPlus className="apex-perf-custom__add-icon" />
                    <span className="apex-perf-custom__add-label">
                        Add KPI
                    </span>
                </button>
            </div>
            )}

            {/* Graph section - same pattern as Standard view */}
            {kpis.length > 0 && (
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-wrap gap-2">
                            {kpis.map((kpi) => (
                                <button
                                    key={kpi.id}
                                    onClick={() =>
                                        toggleKpiSelection(kpi.id)
                                    }
                                    className={`apex-perf-chip${selectedKpis.includes(kpi.id) ? " is-active" : ""}`}
                                >
                                    {kpi.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedKpis.length > 0 ? (
                        <GraphCard
                            variant="cobalt"
                            title={
                                selectedKpis.length === 1
                                    ? `${kpis.find((k) => k.id === selectedKpis[0])?.name || "KPI"} Over Time`
                                    : "Custom KPIs Over Time"
                            }
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                        />
                    ) : (
                        <div className="apex-perf-empty h-64 flex items-center justify-center">
                            <p className="text-sm">
                                Select KPIs above to display on the graph
                            </p>
                        </div>
                    )}
                </div>
            )}

            {modalOpen && (
                <AddKpiModal
                    onClose={handleModalClose}
                    onSave={handleSave}
                    editingKpi={editingKpi}
                    saving={saving}
                    visibleSpendMetricKeys={visibleSpendMetricKeys}
                />
            )}

            {replaceModalKpi && (
                <ReplaceStandardMetricModal
                    open
                    onClose={() => setReplaceModalKpi(null)}
                    kpiName={replaceModalKpi.name}
                    currentReplacementKey={replaceModalKpi.replacesStandardMetricKey}
                    takenKeys={takenReplacementKeys}
                    onSave={handleSaveReplacement}
                    saving={saving}
                />
            )}
        </div>
    );
}
