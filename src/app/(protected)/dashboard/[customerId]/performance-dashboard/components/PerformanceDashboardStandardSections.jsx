"use client";

import React, { useMemo, useState, useCallback } from "react";
import { FiTrendingUp, FiTrendingDown, FiSettings, FiChevronDown, FiChevronRight } from "react-icons/fi";
import ComparisonPeriodPopover from "@/components/dashboard/ComparisonPeriodPopover";
import Spinner from "@/components/ui/Spinner";

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

function MetricChangeBadge({ metric }) {
    if (metric.change === undefined) {
        return <span className="inline-block w-14" />;
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

function CalcBlock({ metric }) {
    if (!metric?.popOverContent) return null;
    const calcLines = metric.popOverContent
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && l.startsWith("=") && /\d/.test(l));
    if (!calcLines.length) return null;
    return (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[10px] font-mono text-gray-600 leading-tight">
            {metric.calcValueLabels && (
                <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                    {metric.calcValueLabels
                        .split("\n")
                        .filter(Boolean)
                        .map((line, i) => {
                            const colonIdx = line.indexOf(":");
                            const label =
                                colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                            const val =
                                colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : "";
                            return (
                                <div key={i} className="flex justify-between gap-4">
                                    <span className="text-gray-500">{label}</span>
                                    <span className="tabular-nums">{val}</span>
                                </div>
                            );
                        })}
                </div>
            )}
            <div className="flex flex-col items-end gap-0.5">
                {calcLines.map((line, i) => (
                    <span
                        key={i}
                        className={
                            i === calcLines.length - 1
                                ? "font-bold text-[var(--color-primary-searchmind)]"
                                : ""
                        }
                    >
                        {line}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function PerformanceDashboardStandardSections({
    sections,
    metrics,
    metricsData,
    loading,
    error,
    showCalcs,
    comparisonMethod,
    selectedMetrics,
    onToggleMetric,
    onReturnsOverrideClick,
}) {
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

    const [expandedGroups, setExpandedGroups] = useState(
        () => new Set(collapsibleGroupKeys)
    );

    React.useEffect(() => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            for (const k of collapsibleGroupKeys) next.add(k);
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

    if (loading) {
        return (
            <div className="col-span-full text-center py-12">
                <Spinner size={40} color="#406969" />
            </div>
        );
    }
    if (error) {
        return (
            <div className="col-span-full text-center text-red-500 py-12">{error}</div>
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
                className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
                <ComparisonPeriodPopover
                    comparisonMethod={comparisonMethod}
                    changePrevValue={primaryMetric?.changePrevValue}
                    changeAbsolute={primaryMetric?.changeAbsolute}
                >
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                            {section.title}
                        </div>
                        <div className="flex items-end justify-between gap-2">
                            <span className="text-2xl font-bold text-[var(--color-primary-searchmind)] tabular-nums">
                                {primaryMetric?.value ?? "-"}
                            </span>
                            {primaryMetric?.change !== undefined && (
                                <MetricChangeBadge metric={primaryMetric} />
                            )}
                        </div>
                        {section.headerSubtitle === "orders" && ordersCount != null && (
                            <div className="mt-1 text-xs text-gray-500">
                                {ordersCount.toLocaleString("da-DK", {
                                    maximumFractionDigits: 0,
                                })}{" "}
                                Orders
                            </div>
                        )}
                        {section.headerSubtitlePct && totalSalesBase > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                                {pctOfTotal} % of total sales
                            </div>
                        )}
                    </div>
                </ComparisonPeriodPopover>

                {showCalcs && primaryMetric?.popOverContent && (
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/30">
                        <CalcBlock metric={primaryMetric} />
                    </div>
                )}

                <div className="flex flex-col divide-y divide-gray-100">
                    {visibleRows.map((row) => {
                        const metricKey = row.metricKey || row.key;
                        const metric = metricsByKey.get(metricKey);
                        if (!metric) return null;

                        const isSelected = selectedMetrics.includes(metricKey);
                        const label = row.label || metric.label;
                        const nested = row.nested;
                        const plClass = nested ? "pl-8" : row.hasChildren ? "pl-4" : "pl-5";

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
                                className={`cursor-pointer transition-colors hover:bg-gray-50/50 ${
                                    isSelected ? "bg-[#1E2B2B]/5" : ""
                                }`}
                                aria-pressed={isSelected}
                            >
                                <ComparisonPeriodPopover
                                    comparisonMethod={comparisonMethod}
                                    changePrevValue={metric.changePrevValue}
                                    changeAbsolute={metric.changeAbsolute}
                                >
                                    <div
                                        className={`pr-4 py-2.5 flex items-center justify-between gap-2 ${plClass}`}
                                    >
                                        <span
                                            className={`flex items-center gap-2 min-w-0 text-sm ${
                                                nested
                                                    ? "text-gray-500 font-normal"
                                                    : "text-gray-800 font-medium"
                                            }`}
                                        >
                                            {row.hasChildren ? (
                                                <button
                                                    type="button"
                                                    className="shrink-0 p-0.5 text-gray-400 hover:text-gray-700"
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
                                                    className={`p-1 rounded-md transition-colors shrink-0 ${
                                                        metric.returnsOverrideActive
                                                            ? "text-purple-600 bg-purple-50"
                                                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                                    }`}
                                                    aria-label="Returns override settings"
                                                    title="Returns % override"
                                                >
                                                    <FiSettings className="text-sm" />
                                                </button>
                                            )}
                                            {metric.isCustomReplacement && (
                                                <span className="text-[10px] font-normal text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded shrink-0">
                                                    Custom
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-semibold tabular-nums text-gray-900 min-w-[80px] text-right">
                                                {metric.value}
                                            </span>
                                            <MetricChangeBadge metric={metric} />
                                        </div>
                                    </div>
                                </ComparisonPeriodPopover>
                                {showCalcs && metric.popOverContent && (
                                    <div className={`pb-3 pt-0 pr-4 ${plClass}`}>
                                        <CalcBlock metric={metric} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    });
}
