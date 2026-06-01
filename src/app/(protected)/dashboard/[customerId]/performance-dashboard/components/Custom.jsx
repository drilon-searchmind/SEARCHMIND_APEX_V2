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
import { AVAILABLE_METRICS } from "./AddKpiModal";
import Spinner from "@/components/ui/Spinner";
import { pushGTMEvent, GTM_EVENTS } from "@root/lib/gtmFunctions";
import { aggregateShopifyAndAdSpendByPeriodFromRows } from "@/lib/mergeAdSpendDaily";

const METRIC_LABELS = Object.fromEntries(
    AVAILABLE_METRICS.map((m) => [m.key, m.label])
);
// Extra metrics from metricsData not in AddKpiModal
Object.assign(METRIC_LABELS, {
    net_sales: "Net Sales",
    cogs: "COGS",
    gross_sales: "Gross Sales",
    discounts: "Discounts",
    shipping_revenue: "Shipping Charges",
    shipping_cost: "Shipping Cost",
    transaction_fee: "Transaction Fee",
    tax: "Taxes",
    duties: "Duties",
    additional_fees: "Additional Fees",
    fixed_costs: "Fixed Costs",
    variable_costs: "Variable Costs",
    pick_pack: "Pick & Pack",
    ebit_pct: "EBIT%",
    meta_spend: "Meta spend",
    google_spend: "Google Ads spend",
    pinterest_spend: "Pinterest spend",
    snapchat_spend: "Snapchat spend",
    bing_spend: "Bing Ads spend",
    reddit_spend: "Reddit spend",
});

const fmt = (n, decimals = 0) =>
    (n ?? 0).toLocaleString("da-DK", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
    });

/** Format a metric value for calc display (currency vs ratio) */
function fmtMetricValue(val, key) {
    if (val == null || isNaN(val)) return "-";
    if (RATIO_KEYS.includes(key))
        return fmt(val, 2);
    if (CURRENCY_KEYS.includes(key) || key === "fixed_costs" || key === "variable_costs" || key === "pick_pack")
        return fmt(val, 0);
    return fmt(val, 0);
}

/** Format formula result for calc display (infer ratio vs currency from operands) */
function fmtFormulaResult(result, parts) {
    if (result == null || isNaN(result)) return "-";
    const metricKeys = parts
        .filter((p) => p.type === "metric")
        .map((p) => p.value);
    const hasDivision = parts.some(
        (p) => p.type === "operator" && p.value === "/"
    );
    const hasOrders = metricKeys.includes("orders");
    const hasCost = metricKeys.includes("cost");
    // ROAS, POAS, Spendshare: division resulting in ratio
    if (hasDivision && (hasCost || metricKeys.includes("revenue")) && !hasOrders)
        return fmt(result, 2);
    return fmt(result, 0);
}

/**
 * Build calc content (valueLabels + calcLines) for any KPI.
 * Used when standard metric has no popOverContent (formulas, single metrics without calc).
 */
function buildKpiCalcContent(kpi, data) {
    const parts = toParts(kpi);
    if (!parts?.length) return null;

    const metricParts = parts.filter((p) => p.type === "metric");

    // Value labels: each metric with its formatted value
    const valueLabelLines = metricParts.map((p) => {
        const key = p.value;
        const val = data[key] ?? 0;
        const label = METRIC_LABELS[key] || key;
        return `${label}: ${fmtMetricValue(val, key)}`;
    });
    const valueLabels = valueLabelLines.join("\n");

    // Calc lines
    const result = evaluateFormula(kpi, data);

    if (metricParts.length === 1) {
        const val = data[metricParts[0].value] ?? 0;
        const key = metricParts[0].value;
        return {
            valueLabels,
            calcLines: [`= ${fmtMetricValue(val, key)}`],
        };
    }

    // Formula: build "= a op b op c" and "= result"
    const exprParts = [];
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.type === "metric") {
            const val = data[p.value] ?? 0;
            exprParts.push(fmtMetricValue(val, p.value));
        } else if (p.type === "operator") {
            const opChar =
                { "/": "÷", "*": "×", "+": "+", "-": "−" }[p.value] ?? p.value;
            exprParts.push(opChar);
        }
    }
    const exprLine = `= ${exprParts.join(" ")}`;
    const resultLine = `= ${fmtFormulaResult(result, parts)}`;
    return {
        valueLabels,
        calcLines: [exprLine, resultLine],
    };
}

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
    showCalcs = false,
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
        const daysInRange =
            dayjs(appliedDateRange.endDate).diff(
                dayjs(appliedDateRange.startDate),
                "day"
            ) + 1;

        const getPrevKey = (currKey, idx) => {
            if (aggregateBy === "monthly") {
                if (comparisonMethod === "Last Year") {
                    return dayjs(currKey + "-01")
                        .subtract(1, "year")
                        .format("YYYY-MM");
                }
                const periodStartMonth = dayjs(
                    appliedDateRange.startDate
                ).startOf("month");
                const prevPeriodEnd = periodStartMonth
                    .subtract(1, "day")
                    .endOf("month");
                const prevPeriodStart = prevPeriodEnd.startOf("month");
                return prevPeriodStart.add(idx, "month").format("YYYY-MM");
            }
            if (comparisonMethod === "Last Year") {
                return dayjs(currKey).subtract(1, "year").format("YYYY-MM-DD");
            }
            const prevStart = dayjs(appliedDateRange.startDate).subtract(
                daysInRange,
                "day"
            );
            return prevStart.add(idx, "day").format("YYYY-MM-DD");
        };

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

            const prevData = categories.map((k, idx) => {
                const prevKey = getPrevKey(k, idx);
                const v = prevAgg[prevKey];
                const val = evaluateFormula(kpi, v);
                return val !== null ? Math.round(Number(val)) : null;
            });
            series.push({
                name: `${kpi.name} (${comparisonMethod})`,
                data: prevData,
            });
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
                fontFamily: "Outfit, sans-serif",
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
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                    {error}
                </div>
            )}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Spinner size={40} color="#406969" />
                </div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full">
                {kpis.map((kpi) => {
                    const rawValue = evaluateFormula(kpi, dataForCards);
                    const displayValue = formatValue(rawValue, kpi);
                    const Icon =
                        METRIC_ICONS[getFirstMetricKey(kpi)] || FiBarChart2;
                    const isSelected = selectedKpis.includes(kpi.id);

                    // Show calc fold-out for ALL custom KPIs when showCalcs is on
                    const parts = toParts(kpi);
                    const isSingleMetric =
                        parts?.length === 1 && parts[0]?.type === "metric";
                    const metricKey = isSingleMetric
                        ? parts[0].value
                        : getFirstMetricKey(kpi);
                    const standardMetric = metrics?.find(
                        (m) => m.key === metricKey
                    );
                    const hasCalc = showCalcs;

                    // Prefer standard metric calc when available; else build from formula
                    let valueLabels, calcLines;
                    if (
                        isSingleMetric &&
                        standardMetric?.popOverContent &&
                        !STORE_REPORTED_METRIC_KEYS.has(metricKey)
                    ) {
                        calcLines = standardMetric.popOverContent
                            .split("\n")
                            .map((l) => l.trim())
                            .filter(
                                (l) =>
                                    l && l.startsWith("=") && /\d/.test(l)
                            );
                        valueLabels = standardMetric.calcValueLabels;
                    } else {
                        const built = buildKpiCalcContent(kpi, dataForCards);
                        valueLabels = built?.valueLabels;
                        calcLines = built?.calcLines;
                    }

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
                            className={`relative group cursor-pointer rounded-lg ${hasCalc && calcLines?.length ? "flex flex-col" : ""}`}
                            aria-pressed={isSelected}
                        >
                            <MetricCard
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
                            {hasCalc && calcLines?.length > 0 && (
                                <div className="mt-0.5 px-3 py-2 rounded-b-xl bg-gray-50 border border-t-0 border-gray-200 text-[10px] font-mono text-gray-600 leading-tight">
                                    {valueLabels && (
                                        <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                                            {valueLabels
                                                .split("\n")
                                                .filter(Boolean)
                                                .map((line, i) => {
                                                    const colonIdx =
                                                        line.indexOf(":");
                                                    const label =
                                                        colonIdx >= 0
                                                            ? line
                                                                  .slice(
                                                                      0,
                                                                      colonIdx
                                                                  )
                                                                  .trim()
                                                            : line;
                                                    const val =
                                                        colonIdx >= 0
                                                            ? line
                                                                  .slice(
                                                                      colonIdx +
                                                                          1
                                                                  )
                                                                  .trim()
                                                            : "";
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="flex justify-between gap-4"
                                                        >
                                                            <span className="text-gray-500">
                                                                {label}
                                                            </span>
                                                            <span className="tabular-nums">
                                                                {val}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                    <div className="flex justify-between gap-4">
                                        {!valueLabels && (
                                            <span className="shrink-0 text-gray-500">
                                                {kpi.name}
                                            </span>
                                        )}
                                        <div
                                            className={`text-right flex flex-col items-end ${valueLabels ? "ml-auto" : ""}`}
                                        >
                                            {calcLines.map((line, i) => (
                                                <span
                                                    key={i}
                                                    className={
                                                        i ===
                                                        calcLines.length - 1
                                                            ? "font-bold text-[var(--color-primary-searchmind)]"
                                                            : ""
                                                    }
                                                >
                                                    {line}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setReplaceModalKpi(kpi);
                                    }}
                                    className="p-1.5 rounded-lg bg-white/90 hover:bg-purple-50 text-gray-400 hover:text-purple-700 shadow-sm"
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
                                    className="p-1.5 rounded-lg bg-white/90 hover:bg-gray-100 text-gray-400 hover:text-gray-600 shadow-sm"
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
                                    className="p-1.5 rounded-lg bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-600 shadow-sm"
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
                    className="group flex flex-col justify-center items-center border-2 border-dashed border-gray-300 rounded-xl min-w-[160px] min-h-[110px] px-6 py-5 hover:border-[var(--color-primary-searchmind)] hover:bg-gray-50/50 transition-colors"
                    aria-label="Add KPI"
                >
                    <FiPlus className="text-3xl text-gray-400 group-hover:text-[var(--color-primary-searchmind)] transition-colors" />
                    <span className="text-xs text-gray-400 mt-2 group-hover:text-[var(--color-primary-searchmind)] transition-colors">
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
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${
                                        selectedKpis.includes(kpi.id)
                                            ? "bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]"
                                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                                    }`}
                                >
                                    {kpi.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedKpis.length > 0 ? (
                        <GraphCard
                            title={
                                selectedKpis.length === 1
                                    ? `${kpis.find((k) => k.id === selectedKpis[0])?.name || "KPI"} Over Time`
                                    : "Custom KPIs Over Time"
                            }
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-64 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <p className="text-sm text-gray-500">
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
