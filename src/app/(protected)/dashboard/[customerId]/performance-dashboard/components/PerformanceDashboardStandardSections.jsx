"use client";

import React, { useMemo, useState, useCallback } from "react";
import { FiTrendingUp, FiTrendingDown, FiSettings, FiChevronDown, FiChevronRight } from "react-icons/fi";
import ComparisonPeriodPopover from "@/components/dashboard/ComparisonPeriodPopover";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCountUp } from "@/hooks/useCountUp";

/** Section header totals that count up from 0 when data loads or date range changes. */
const COUNT_UP_SECTION_PRIMARY_KEYS = new Set([
    "total_sales_ex_vat",
    "gross_profit",
    "gross_profit_minus_ad_spend",
    "ebit",
]);

function formatCountUpCurrency(n) {
    const rounded = Math.round(n);
    if (rounded === 0) return "-";
    return rounded.toLocaleString("da-DK", {
        style: "currency",
        currency: "DKK",
        maximumFractionDigits: 0,
    });
}

function SectionPrimaryValue({ primaryKey, metric, metricsData, className }) {
    const raw = metricsData?.[primaryKey];
    const shouldCount = COUNT_UP_SECTION_PRIMARY_KEYS.has(primaryKey);
    const numeric =
        shouldCount && raw != null && !Number.isNaN(Number(raw))
            ? Number(raw)
            : null;
    const animated = useCountUp(numeric, {
        duration: 400,
        enabled: shouldCount && numeric != null,
    });
    const display =
        shouldCount && numeric != null
            ? formatCountUpCurrency(animated)
            : metric?.value ?? "-";

    return <span className={className}>{display}</span>;
}

function flattenVisibleRows(breakdown, expandedGroups) {
    const rows = [];
    const walk = (items, depth = 0) => {
        for (const item of items || []) {
            const hasChildren = item.children?.length > 0;
            const expanded = !item.collapsible || expandedGroups.has(item.key);
            rows.push({ ...item, depth, hasChildren, expanded });
            if (hasChildren && expanded) {
                walk(item.children, depth + 1);
            }
        }
    };
    walk(breakdown);
    return rows;
}

function MetricChangeBadge({ metric, variant = "default" }) {
    if (metric.change === undefined) {
        return <span className="inline-block w-14" />;
    }

    if (variant === "cobalt") {
        return (
            <span
                className={`apex-perf-change ${
                    metric.changeType === "up"
                        ? "is-up"
                        : metric.changeType === "down"
                          ? "is-down"
                          : "is-neutral"
                }`}
            >
                {metric.changeType === "up" ? (
                    <FiTrendingUp className="text-xs" aria-hidden />
                ) : metric.changeType === "down" ? (
                    <FiTrendingDown className="text-xs" aria-hidden />
                ) : null}
                {metric.change}%
            </span>
        );
    }

    return (
        <span
            className={`text-[0.65rem] rounded-sm font-medium flex items-center justify-end gap-0.5 px-1.5 py-0.5 min-w-[3.5rem] tabular-nums ${
                metric.changeType === "up"
                    ? "text-green-600 bg-green-50"
                    : metric.changeType === "down"
                      ? "text-red-600 bg-red-50"
                      : "text-gray-600 bg-gray-100"
            }`}
        >
            {metric.changeType === "up" ? (
                <FiTrendingUp className="text-xs" />
            ) : metric.changeType === "down" ? (
                <FiTrendingDown className="text-xs" />
            ) : null}
            {metric.change}%
        </span>
    );
}

export default function PerformanceDashboardStandardSections({
    sections,
    metrics,
    metricsData,
    loading,
    error,
    comparisonMethod,
    selectedMetrics,
    onToggleMetric,
    onReturnsOverrideClick,
    onCogsSettingsClick,
    onVariableCostSettingsClick,
    onFixedExpensesSettingsClick,
    onGa4ConversionSettingsClick,
    variant = "default",
}) {
    const isCobalt = variant === "cobalt";

    const metricsByKey = useMemo(
        () => new Map(metrics.map((m) => [m.key, m])),
        [metrics]
    );

    const collapsibleGroupKeys = useMemo(() => {
        const keys = [];
        const walk = (items) => {
            for (const item of items || []) {
                if (item.collapsible && item.children?.length) keys.push(item.key);
                walk(item.children);
            }
        };
        for (const s of sections) walk(s.breakdown);
        return keys;
    }, [sections]);

    const [expandedGroups, setExpandedGroups] = useState(() => new Set());

    React.useEffect(() => {
        setExpandedGroups((prev) => {
            const next = new Set();
            for (const k of prev) {
                if (collapsibleGroupKeys.includes(k)) next.add(k);
            }
            return next;
        });
    }, [collapsibleGroupKeys]);

    const toggleGroup = useCallback((groupKey) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    }, []);

    const totalSalesBase = metricsData?.total_sales_ex_vat ?? metricsData?.total_sales ?? 0;
    const ordersCount = metricsData?.orders;

    const renderHeaderSubtitle = (section) => {
        const subClass = isCobalt ? "apex-perf-section__sub" : "mt-1 text-xs text-gray-500";

        if (section.headerSubtitle === "orders" && ordersCount != null) {
            return (
                <div className={subClass}>
                    {ordersCount.toLocaleString("da-DK", { maximumFractionDigits: 0 })} Orders
                </div>
            );
        }
        if (section.headerSubtitle === "users" && metricsData?.totalUsers != null) {
            return (
                <div className={subClass}>
                    {Number(metricsData.totalUsers).toLocaleString("da-DK", { maximumFractionDigits: 0 })}{" "}
                    Users
                </div>
            );
        }
        if (section.headerSubtitle === "conversion_rate" && metricsData?.conversion_rate != null) {
            const pct = Number(metricsData.conversion_rate) || 0;
            return (
                <div className={subClass}>
                    {pct.toFixed(2)}% conversion rate
                </div>
            );
        }
        if (section.headerSubtitle === "cost_per_session" && metricsData?.cost_per_session != null) {
            const cps = Number(metricsData.cost_per_session) || 0;
            return (
                <div className={subClass}>
                    {cps.toLocaleString("da-DK", {
                        style: "currency",
                        currency: "DKK",
                        maximumFractionDigits: 0,
                    })}{" "}
                    per session
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="col-span-full apex-perf-loading">
                <CobaltLoader
                    variant="panel"
                    eyebrow="Performance"
                    title="Loading metrics"
                    subtitle="Fetching revenue, ad spend, and KPI calculations for the selected period."
                    steps={[
                        "Load merged sources",
                        "Apply date range filters",
                        "Compute overview metrics",
                    ]}
                    request="GET /api/merged-sources"
                />
            </div>
        );
    }
    if (error) {
        return (
            <div className={isCobalt ? "col-span-full apex-perf-alert apex-perf-alert--error" : "col-span-full text-center text-red-500 py-12"}>
                {error}
            </div>
        );
    }

    return sections.map((section) => {
        const primaryMetric = metricsByKey.get(section.primaryKey);
        const primaryValue = metricsData?.[section.primaryKey] ?? 0;
        const pctKey = section.pctMetricKey || section.primaryKey;
        const pctValue =
            section.headerSubtitlePct && section.pctMetricKey
                ? metricsData?.[section.pctMetricKey]
                : primaryValue;
        const pctOfTotal =
            totalSalesBase > 0
                ? ((pctValue / totalSalesBase) * 100).toLocaleString("da-DK", {
                      maximumFractionDigits: 2,
                  })
                : "0";

        const visibleRows = flattenVisibleRows(section.breakdown, expandedGroups);

        return (
            <div
                key={section.key}
                className={
                    isCobalt
                        ? "apex-perf-section"
                        : "flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden"
                }
            >
                <ComparisonPeriodPopover
                    comparisonMethod={comparisonMethod}
                    changePrevValue={primaryMetric?.changePrevValue}
                    changeAbsolute={primaryMetric?.changeAbsolute}
                >
                    <div className={isCobalt ? "apex-perf-section__head" : "px-4 py-3 border-b border-gray-100 bg-gray-50/50"}>
                        <div className={isCobalt ? "apex-perf-section__eyebrow" : "flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"}>
                            <span>{section.title}</span>
                            {section.ga4ConversionSettings && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onGa4ConversionSettingsClick?.();
                                    }}
                                    className={`${isCobalt ? "apex-perf-icon-btn" : "p-1 rounded-md transition-colors shrink-0 normal-case"} ${
                                        !isCobalt && primaryMetric?.ga4ConversionSettingsActive
                                            ? "text-purple-600 bg-purple-50"
                                            : !isCobalt
                                              ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                              : primaryMetric?.ga4ConversionSettingsActive
                                                ? "is-active"
                                                : ""
                                    }`}
                                    aria-label="GA4 conversion events settings"
                                    title="Configure conversion events"
                                >
                                    <FiSettings className="text-sm" />
                                </button>
                            )}
                        </div>
                        <div className={isCobalt ? "apex-perf-section__value-row" : "flex items-end justify-between gap-2"}>
                            <SectionPrimaryValue
                                primaryKey={section.primaryKey}
                                metric={primaryMetric}
                                metricsData={metricsData}
                                className={
                                    isCobalt
                                        ? "apex-perf-section__value"
                                        : "text-2xl font-bold text-[var(--color-primary-searchmind)] tabular-nums"
                                }
                            />
                            {primaryMetric?.change !== undefined && (
                                <MetricChangeBadge metric={primaryMetric} variant={variant} />
                            )}
                        </div>
                        {renderHeaderSubtitle(section)}
                        {section.headerSubtitlePct && !section.headerSubtitle && totalSalesBase > 0 && (
                            <div className={isCobalt ? "apex-perf-section__sub" : "mt-1 text-xs text-gray-500"}>
                                {pctOfTotal} % of total sales
                            </div>
                        )}
                    </div>
                </ComparisonPeriodPopover>

                <div className={isCobalt ? "apex-perf-section__rows" : "flex flex-col divide-y divide-gray-100"}>
                    {visibleRows.map((row) => {
                        const metricKey = row.metricKey || row.key;
                        const metric = metricsByKey.get(metricKey);
                        if (!metric) return null;

                        const isSelected = selectedMetrics.includes(metricKey);
                        const label = row.label || metric.label;
                        const nested = row.nested;
                        const plClass = nested ? "pl-8" : row.hasChildren ? "pl-4" : "pl-5";

                        const rowInnerClass = isCobalt
                            ? `apex-perf-section__row-inner${nested ? " is-nested" : row.hasChildren ? " is-group" : ""}`
                            : `pr-4 py-2.5 flex items-center justify-between gap-2 ${plClass}`;

                        const settingsBtnClass = isCobalt
                            ? `apex-perf-icon-btn${metric.returnsOverrideActive || metric.cogsSettingsHighlight || metric.variableCostSettingsHighlight || metric.fixedExpensesSettingsActive || metric.ga4ConversionSettingsActive ? " is-active" : ""}`
                            : `p-1 rounded-md transition-colors shrink-0 ${
                                  metric.returnsOverrideActive ||
                                  metric.cogsSettingsHighlight ||
                                  metric.variableCostSettingsHighlight ||
                                  metric.fixedExpensesSettingsActive
                                      ? "text-purple-600 bg-purple-50"
                                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                              }`;

                        return (
                            <div
                                key={`${section.key}-${row.key}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => onToggleMetric(metricKey)}
                                onKeyDown={(e) =>
                                    (e.key === "Enter" || e.key === " ") &&
                                    onToggleMetric(metricKey)
                                }
                                className={
                                    isCobalt
                                        ? `apex-perf-section__row${isSelected ? " is-selected" : ""}`
                                        : `cursor-pointer transition-colors hover:bg-gray-50/50 ${isSelected ? "bg-[#1E2B2B]/5" : ""}`
                                }
                                aria-pressed={isSelected}
                            >
                                <ComparisonPeriodPopover
                                    comparisonMethod={comparisonMethod}
                                    changePrevValue={metric.changePrevValue}
                                    changeAbsolute={metric.changeAbsolute}
                                >
                                    <div className={rowInnerClass}>
                                        <span
                                            className={
                                                isCobalt
                                                    ? `apex-perf-section__row-label${nested ? " is-nested" : ""}`
                                                    : `flex items-center gap-2 min-w-0 text-sm ${
                                                          nested
                                                              ? "text-gray-500 font-normal"
                                                              : "text-gray-800 font-medium"
                                                      }`
                                            }
                                        >
                                            {row.hasChildren ? (
                                                <button
                                                    type="button"
                                                    className={isCobalt ? "apex-perf-icon-btn shrink-0" : "shrink-0 p-0.5 text-gray-400 hover:text-gray-700"}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleGroup(row.key);
                                                    }}
                                                    aria-expanded={row.expanded}
                                                >
                                                    {row.expanded ? (
                                                        <FiChevronDown className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <FiChevronRight className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="w-4 shrink-0" aria-hidden />
                                            )}
                                            <span className="truncate">{label}</span>
                                            {row.returnsSettings && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onReturnsOverrideClick?.();
                                                    }}
                                                    className={settingsBtnClass}
                                                    aria-label="Returns override settings"
                                                    title="Returns % override"
                                                >
                                                    <FiSettings className="text-sm" />
                                                </button>
                                            )}
                                            {row.cogsSettings && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCogsSettingsClick?.();
                                                    }}
                                                    className={settingsBtnClass}
                                                    aria-label="COGS settings"
                                                    title="COGS source & %"
                                                >
                                                    <FiSettings className="text-sm" />
                                                </button>
                                            )}
                                            {row.variableCostSettings && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onVariableCostSettingsClick?.(
                                                            row.variableCostSettings
                                                        );
                                                    }}
                                                    className={settingsBtnClass}
                                                    aria-label={`${label} settings`}
                                                    title={`Edit ${label} settings`}
                                                >
                                                    <FiSettings className="text-sm" />
                                                </button>
                                            )}
                                            {row.fixedExpensesSettings && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onFixedExpensesSettingsClick?.();
                                                    }}
                                                    className={settingsBtnClass}
                                                    aria-label="Fixed expenses settings"
                                                    title="Fixed monthly expenses"
                                                >
                                                    <FiSettings className="text-sm" />
                                                </button>
                                            )}
                                            {metric.isCustomReplacement && (
                                                <span className={isCobalt ? "apex-perf-tag" : "text-[10px] font-normal text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0"}>
                                                    Custom
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={isCobalt ? "apex-perf-section__row-value" : "text-sm font-semibold tabular-nums text-gray-900 min-w-[80px] text-right"}>
                                                {metric.value}
                                            </span>
                                            <MetricChangeBadge metric={metric} variant={variant} />
                                        </div>
                                    </div>
                                </ComparisonPeriodPopover>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    });
}
