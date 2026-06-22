"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiRepeat } from "react-icons/fi";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import AddKpiModal from "./AddKpiModal";
import ReplaceStandardMetricModal from "./ReplaceStandardMetricModal";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { B2B_METRIC_DEFS } from "@/lib/b2bDashboard/b2bKpiConstants";
import { B2B_REPLACEABLE_STANDARD_METRICS } from "@/lib/b2bDashboard/b2bKpiConstants";
import { evaluateB2BFormula } from "@/lib/b2bDashboard/b2bKpiFormulaUtils";
import { buildB2BDailySeries } from "@/lib/b2bDashboard/b2bOverviewMetrics";
import { getChartColors } from "@/components/dashboard/chartColors";
import { COMPARISON_METHOD, getComparisonMethodLabel } from "@/lib/dateRangeComparison";

const B2B_AVAILABLE_METRICS = B2B_METRIC_DEFS.map((m) => ({ ...m, icon: undefined }));

async function fetchB2BKpis(customerId) {
    const res = await fetch(`/api/custom-kpis/${customerId}?context=b2b`);
    if (!res.ok) throw new Error("Failed to fetch custom KPIs");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function formatKpiValue(value, kpi) {
    if (value == null || Number.isNaN(value)) return "-";
    return Number(value).toLocaleString("da-DK", { maximumFractionDigits: 2 });
}

export default function B2BCustom({
    customerId,
    metricsData,
    metricsDataPrev,
    current,
    comparison,
    comparisonMethod,
    visibleSpendMetricKeys = [],
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

    const loadKpis = useCallback(async () => {
        if (!customerId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchB2BKpis(customerId);
            setKpis(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        loadKpis();
    }, [loadKpis]);

    useEffect(() => {
        setSelectedKpis((prev) => {
            const ids = kpis.map((k) => k.id || k._id);
            const kept = prev.filter((id) => ids.includes(id));
            if (kept.length === 0 && kpis.length > 0) return [ids[0]];
            return kept;
        });
    }, [kpis]);

    const handleSave = async (kpi) => {
        setSaving(true);
        try {
            const isEdit = kpis.some((k) => (k.id || k._id) === kpi.id);
            const payload = {
                name: kpi.name,
                parts: kpi.parts || [],
                dashboardContext: "b2b",
            };
            const url = isEdit
                ? `/api/custom-kpis/${customerId}/${kpi.id}`
                : `/api/custom-kpis/${customerId}`;
            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to save KPI");
            await loadKpis();
            onKpisUpdated?.();
            setModalOpen(false);
            setEditingKpi(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (kpiId) => {
        if (!window.confirm("Delete this KPI?")) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/custom-kpis/${customerId}/${kpiId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete KPI");
            await loadKpis();
            onKpisUpdated?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReplaceSave = async (metricKey) => {
        if (!replaceModalKpi) return;
        setSaving(true);
        try {
            const res = await fetch(
                `/api/custom-kpis/${customerId}/${replaceModalKpi.id || replaceModalKpi._id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        replacesStandardMetricKey: metricKey,
                        dashboardContext: "b2b",
                    }),
                }
            );
            if (!res.ok) throw new Error("Failed to update KPI");
            await loadKpis();
            onKpisUpdated?.();
            setReplaceModalKpi(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const { currRows, prevRows, categories } = useMemo(
        () => buildB2BDailySeries(current, comparison),
        [current, comparison]
    );

    const comparisonLabel = getComparisonMethodLabel(comparisonMethod);
    const chartColors = getChartColors();

    const chartSeries = useMemo(() => {
        const selected = kpis.filter((k) => selectedKpis.includes(k.id || k._id));
        if (!selected.length || !categories.length) return [];

        return selected.flatMap((kpi) => {
            const currData = currRows.map((row) => evaluateB2BFormula(kpi, row) ?? 0);
            const series = [
                {
                    name: `${kpi.name} (Current)`,
                    data: currData,
                    color: chartColors.primaryLighter || "#406969",
                },
            ];
            if (comparisonMethod !== COMPARISON_METHOD.NONE && prevRows.length) {
                const prevData = categories.map((date, idx) => {
                    const prevRow = prevRows[idx] || prevRows[prevRows.length - 1];
                    return evaluateB2BFormula(kpi, prevRow) ?? 0;
                });
                series.push({
                    name: `${kpi.name} (${comparisonLabel})`,
                    data: prevData,
                    color: "#94a3b8",
                });
            }
            return series;
        });
    }, [kpis, selectedKpis, categories, currRows, prevRows, comparisonMethod, comparisonLabel, chartColors]);

    const chartOptions = useMemo(
        () => ({
            chart: { toolbar: { show: false }, fontFamily: "Inter, sans-serif" },
            xaxis: { categories, labels: { rotate: -45 } },
            stroke: { curve: "smooth", width: 2 },
            legend: { show: true, position: "top" },
            tooltip: { shared: true },
        }),
        [categories]
    );

    const takenReplacementKeys = kpis
        .filter((k) => k.replacesStandardMetricKey)
        .map((k) => k.replacesStandardMetricKey);

    if (loading) {
        return (
            <div className="apex-perf-loading">
                <CobaltLoader
                    variant="panel"
                    eyebrow="B2B KPIs"
                    title="Loading custom KPIs"
                    subtitle="Fetching GA4 and ad spend formulas for this property."
                    steps={["Load custom KPIs", "Evaluate B2B metrics"]}
                    request="GET /api/custom-kpis?context=b2b"
                />
            </div>
        );
    }

    return (
        <div>
            {error && (
                <div className="apex-perf-alert apex-perf-alert--error mb-4">
                    {error}
                </div>
            )}

            <div className="apex-perf-custom__header">
                <p className="text-sm text-[var(--color-muted)] mb-0">
                    Build custom lead-gen KPIs from GA4 traffic and ad spend metrics.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setEditingKpi(null);
                        setModalOpen(true);
                    }}
                    className="apex-perf-btn apex-perf-btn--primary"
                >
                    <FiPlus /> Add KPI
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                {kpis.map((kpi) => {
                    const id = kpi.id || kpi._id;
                    const val = evaluateB2BFormula(kpi, metricsData);
                    const valPrev = evaluateB2BFormula(kpi, metricsDataPrev);
                    const isSelected = selectedKpis.includes(id);
                    let change;
                    if (valPrev != null && valPrev !== 0) {
                        change = (((val ?? 0) - valPrev) / Math.abs(valPrev)) * 100;
                    }
                    return (
                        <div key={id} className="relative group min-w-0">
                            <div
                                role="button"
                                tabIndex={0}
                                className="cursor-pointer min-w-0"
                                onClick={() =>
                                    setSelectedKpis((prev) =>
                                        prev.includes(id)
                                            ? prev.length > 1
                                                ? prev.filter((x) => x !== id)
                                                : prev
                                            : [...prev, id]
                                    )
                                }
                            >
                                <MetricCard
                                    variant="cobalt"
                                    label={kpi.name}
                                    value={formatKpiValue(val, kpi)}
                                    change={change != null ? change.toFixed(1) : undefined}
                                    changeType={change > 0 ? "up" : change < 0 ? "down" : undefined}
                                    comparisonMethod={comparisonLabel}
                                    isActive={isSelected}
                                    className="min-w-0"
                                />
                            </div>
                            <div className="apex-perf-custom__hover-actions">
                                <button
                                    type="button"
                                    className="apex-perf-icon-btn"
                                    onClick={() => {
                                        setEditingKpi({ ...kpi, id });
                                        setModalOpen(true);
                                    }}
                                    aria-label="Edit KPI"
                                >
                                    <FiEdit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    className="apex-perf-icon-btn"
                                    onClick={() => setReplaceModalKpi({ ...kpi, id })}
                                    aria-label="Replace standard metric"
                                >
                                    <FiRepeat className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    className="apex-perf-icon-btn hover:text-[var(--color-error)]"
                                    onClick={() => handleDelete(id)}
                                    aria-label="Delete KPI"
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {kpis.length === 0 && (
                <div className="apex-perf-empty mb-8">
                    No custom KPIs yet. Click &quot;Add KPI&quot; to create one (e.g. Conversions ÷ Marketing Spend).
                </div>
            )}

            {chartSeries.length > 0 && (
                <GraphCard
                    variant="cobalt"
                    title="Custom KPIs Over Time"
                    chartOptions={chartOptions}
                    chartSeries={chartSeries}
                    height={320}
                />
            )}

            {modalOpen && (
                <AddKpiModal
                    onClose={() => {
                        setModalOpen(false);
                        setEditingKpi(null);
                    }}
                    onSave={handleSave}
                    editingKpi={editingKpi}
                    saving={saving}
                    visibleSpendMetricKeys={visibleSpendMetricKeys}
                    availableMetrics={B2B_AVAILABLE_METRICS}
                    formulaHelpText="Combine GA4 metrics (sessions, conversions, engagement) with marketing spend. Calculations run left to right — e.g. Conversions ÷ Marketing Spend for a custom CPL."
                />
            )}

            <ReplaceStandardMetricModal
                open={!!replaceModalKpi}
                onClose={() => setReplaceModalKpi(null)}
                kpiName={replaceModalKpi?.name || ""}
                currentReplacementKey={replaceModalKpi?.replacesStandardMetricKey}
                takenKeys={takenReplacementKeys}
                onSave={handleReplaceSave}
                saving={saving}
                replaceableMetrics={B2B_REPLACEABLE_STANDARD_METRICS}
            />
        </div>
    );
}
