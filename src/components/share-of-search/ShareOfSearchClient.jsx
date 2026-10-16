"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import Select from "react-select";
import {
    FiPlus,
    FiRefreshCw,
    FiTrash2,
    FiRotateCcw,
    FiTrendingUp,
    FiLayers,
    FiLink2,
} from "react-icons/fi";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import GraphCard from "@/components/dashboard/GraphCard";
import MetricCard from "@/components/dashboard/MetricCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { getCobaltChartBaseOptions } from "@/lib/charts/cobaltChartTheme";
import { cn } from "@/lib/utils";
import {
    getCountrySelectOptions,
    isWorldwideGeoValue,
    matchCountryOption,
} from "@/lib/countrySelectOptions";
import { shareOfSearchBrandColor } from "@/lib/shareOfSearchBrandColors";
import {
    buildDisplayRowsFromBrandGroups,
    brandToGroupIdMap,
    newBrandGroupId,
    normalizeBrandGroups,
    remapSelectedChartKeys,
} from "@/lib/shareOfSearchBrandGroups";

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

const COUNTRY_SELECT_STYLES = {
    control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 14,
        borderColor: state.isFocused ? "#131313" : "#d8d5d0",
        boxShadow: state.isFocused ? "0 0 0 1px #131313" : "none",
        fontSize: "0.875rem",
        backgroundColor: "#ffffff",
        "&:hover": { borderColor: "#131313" },
    }),
    menu: (base) => ({ ...base, zIndex: 50, backgroundColor: "#ffffff" }),
    option: (base, state) => ({
        ...base,
        fontSize: "0.875rem",
        backgroundColor: state.isSelected
            ? "#131313"
            : state.isFocused
              ? "#f4f3f1"
              : "#ffffff",
        color: state.isSelected ? "#ffffff" : "#131313",
    }),
    singleValue: (base) => ({ ...base, color: "#131313" }),
    input: (base) => ({ ...base, color: "#131313" }),
};

function parseMonthKey(m) {
    if (!m) return null;
    const y = Number(m.year);
    let mon = m.month;
    if (typeof mon === "string") mon = MONTH_OF_YEAR[mon.toUpperCase()];
    if (!y || !mon) return null;
    return `${y}-${String(mon).padStart(2, "0")}`;
}

function monthKeysInRange(startDate, endDate) {
    const keys = [];
    let d = dayjs(startDate).startOf("month");
    const end = dayjs(endDate).endOf("month");
    while (!d.isAfter(end, "month")) {
        keys.push(d.format("YYYY-MM"));
        d = d.add(1, "month");
    }
    return keys;
}

function categoryLabel(ym) {
    return dayjs(`${ym}-01`).format("MMM YYYY");
}

function seriesForBrand(row, monthKeys) {
    const map = new Map();
    const msv = row.monthlySearchVolumes || row.monthly_search_volumes || [];
    for (const m of msv) {
        const k = parseMonthKey(m);
        if (k) map.set(k, Number(m.monthlySearches ?? m.monthly_searches ?? 0));
    }
    let data = monthKeys.map((k) => map.get(k) ?? 0);
    const sum = data.reduce((a, b) => a + b, 0);
    const vol = Number(row.volumeInRange || 0);
    if (sum === 0 && vol > 0 && monthKeys.length > 0) {
        const per = Math.round(vol / monthKeys.length);
        data = monthKeys.map(() => per);
    }
    return data;
}

function totalSeriesByMonth(brandSeries) {
    if (!brandSeries.length) return [];
    const len = brandSeries[0].data.length;
    const out = new Array(len).fill(0);
    for (const s of brandSeries) {
        for (let i = 0; i < len; i++) {
            out[i] += Number(s.data[i] || 0);
        }
    }
    return out;
}

/** Per month: each series value becomes integer % of the sum of selected series that month. */
function toSharePercentSeries(series) {
    if (!series.length) return [];
    const len = series[0].data.length;
    const out = series.map((s) => ({
        name: s.name,
        data: s.data.map((v) => Math.max(0, Number(v) || 0)),
    }));
    for (let j = 0; j < len; j++) {
        let sum = 0;
        for (const s of out) sum += s.data[j];
        for (const s of out) {
            const v = s.data[j];
            s.data[j] = sum > 0 ? Math.round((v / sum) * 100) : 0;
        }
    }
    return out;
}


function formatSharePctValue(val) {
    if (val == null || val === "" || Number.isNaN(Number(val))) return "—";
    return `${Number(val).toFixed(2)}%`;
}

/** Google Ads Keyword Planner language code from country / market selection. */
function languageCodeForGeo(geoValue) {
    if (isWorldwideGeoValue(geoValue)) return "en";
    const code = String(geoValue || "").trim().toUpperCase();
    const map = {
        DK: "da",
        SE: "sv",
        NO: "no",
        FI: "fi",
        DE: "de",
        AT: "de",
        CH: "de",
        NL: "nl",
        BE: "nl",
        FR: "fr",
        ES: "es",
        IT: "it",
        PT: "pt",
        PL: "pl",
        GB: "en",
        UK: "en",
        US: "en",
        IE: "en",
    };
    return map[code] || "en";
}

function formatComparisonRange(range) {
    if (!range?.startDate || !range?.endDate) return null;
    return `${range.startDate} → ${range.endDate}`;
}

/** DateRangePicker presets only for Share of Search */
function getShareOfSearchDatePresets() {
    return [
        {
            label: "This year",
            getRange: () => {
                const end = dayjs().subtract(1, "day");
                let start = dayjs().startOf("year");
                if (start.isAfter(end)) start = end;
                return { start, end };
            },
        },
        {
            label: "Last Year",
            getRange: () => ({
                start: dayjs().subtract(1, "year").startOf("year"),
                end: dayjs().subtract(1, "year").endOf("year"),
            }),
        },
        ...[2, 3, 4, 5].map((n) => ({
            label: `${n} Years (From today)`,
            getRange: () => {
                const end = dayjs().subtract(1, "day");
                const start = end.subtract(n, "year");
                return { start, end };
            },
        })),
    ];
}

function rowChartKey(row) {
    return String(row.key ?? row.brand);
}

function getDefaultChartKeys(rows, mode) {
    if (!rows?.length) return [];
    const keys = rows.map(rowChartKey);
    if (mode === "share") return keys;
    return ["__total__", ...keys];
}

export default function ShareOfSearchClient() {
    const params = useParams();
    const customerId = params?.customerId;
    const { customers } = useCustomers();
    const customer = customers.find((c) => String(c._id) === String(customerId));

    const countryOptions = useMemo(() => getCountrySelectOptions(), []);
    const shareOfSearchDatePresets = useMemo(() => getShareOfSearchDatePresets(), []);

    const today = new Date();
    const defaultEnd = dayjs(today).subtract(1, "day");
    const defaultStart = defaultEnd.subtract(11, "month").startOf("month");
    const defaultRange = {
        startDate: defaultStart.format("YYYY-MM-DD"),
        endDate: defaultEnd.format("YYYY-MM-DD"),
    };

    const [tempRange, setTempRange] = useState(defaultRange);
    const [appliedRange, setAppliedRange] = useState(defaultRange);
    const [brands, setBrands] = useState([]);
    const [draft, setDraft] = useState("");
    const [geoLabel, setGeoLabel] = useState("DK");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [metricsRows, setMetricsRows] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [selectedChartKeys, setSelectedChartKeys] = useState([]);
    const [chartDisplayMode, setChartDisplayMode] = useState("share");
    /** stacked area (default) vs overlapping lines */
    const [chartVisualMode, setChartVisualMode] = useState("stacked");
    const [comparisonRanges, setComparisonRanges] = useState(null);
    const [brandGroups, setBrandGroups] = useState([]);
    const [groupsSaving, setGroupsSaving] = useState(false);
    const [selectedForGroup, setSelectedForGroup] = useState(() => new Set());
    const [groupNameDraft, setGroupNameDraft] = useState("");

    const countryValue = useMemo(() => {
        return (
            matchCountryOption(geoLabel, countryOptions) ||
            countryOptions.find((o) => o.value === "DK") ||
            countryOptions[0]
        );
    }, [countryOptions, geoLabel]);

    const loadBrandGroups = useCallback(async () => {
        if (!customerId) return;
        try {
            const res = await fetch(`/api/share-of-search/${customerId}/brand-groups`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not load brand groups");
            const loaded = normalizeBrandGroups(data.brandGroups || []);
            setBrandGroups(loaded);
            setBrands((prev) => {
                const merged = new Set(prev);
                for (const g of loaded) {
                    for (const b of g.brands) merged.add(b);
                }
                return [...merged];
            });
        } catch (e) {
            console.error(e);
        }
    }, [customerId]);

    const loadHistory = useCallback(async () => {
        if (!customerId) return;
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/share-of-search/${customerId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not load history");
            setHistory(data.items || []);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        loadHistory();
        loadBrandGroups();
    }, [loadHistory, loadBrandGroups]);

    const saveBrandGroups = useCallback(
        async (groups) => {
            if (!customerId) return;
            const normalized = normalizeBrandGroups(groups);
            setGroupsSaving(true);
            try {
                const res = await fetch(`/api/share-of-search/${customerId}/brand-groups`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ brandGroups: normalized }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Could not save groups");
                const saved = normalizeBrandGroups(data.brandGroups || normalized);
                setBrandGroups(saved);
                setSelectedChartKeys((prev) =>
                    remapSelectedChartKeys(
                        prev,
                        metricsRows,
                        saved,
                        saved.length > 0
                    )
                );
            } catch (e) {
                setError(e.message || "Could not save brand groups");
            } finally {
                setGroupsSaving(false);
            }
        },
        [customerId, metricsRows]
    );

    const normalizedGroups = useMemo(() => normalizeBrandGroups(brandGroups), [brandGroups]);
    const applyBrandGroupsInCharts = normalizedGroups.length > 0;
    const assignedBrandMap = useMemo(() => brandToGroupIdMap(normalizedGroups), [normalizedGroups]);
    const ungroupedBrands = useMemo(
        () => brands.filter((b) => !assignedBrandMap.has(b)),
        [brands, assignedBrandMap]
    );

    const persistBrandGroups = useCallback(
        (groups) => {
            saveBrandGroups(normalizeBrandGroups(groups));
        },
        [saveBrandGroups]
    );

    const displayRows = useMemo(
        () =>
            buildDisplayRowsFromBrandGroups(metricsRows, brandGroups, {
                applyGroups: applyBrandGroupsInCharts,
            }),
        [metricsRows, brandGroups, applyBrandGroupsInCharts]
    );

    const handleApplyRange = ({ startDate, endDate }) => {
        setAppliedRange({ startDate, endDate });
    };

    const addBrand = () => {
        const b = draft.trim();
        if (!b) return;
        setBrands((prev) => (prev.includes(b) ? prev : [...prev, b]));
        setDraft("");
    };

    const removeBrand = (b) => {
        setSelectedForGroup((prev) => {
            const n = new Set(prev);
            n.delete(b);
            return n;
        });
        setBrands((prevBrands) => {
            const nextBrands = prevBrands.filter((x) => x !== b);
            setBrandGroups((prevGroups) => {
                const allowed = new Set(nextBrands);
                const next = normalizeBrandGroups(
                    prevGroups
                        .map((g) => ({
                            ...g,
                            brands: g.brands.filter((x) => allowed.has(x)),
                        }))
                        .filter((g) => g.brands.length > 0)
                );
                persistBrandGroups(next);
                return next;
            });
            return nextBrands;
        });
    };

    const clearBrands = () => {
        setBrands([]);
        setBrandGroups([]);
        persistBrandGroups([]);
        setDraft("");
        setGroupNameDraft("");
        setSelectedForGroup(new Set());
        setMetricsRows(null);
        setSelectedChartKeys([]);
        setComparisonRanges(null);
        setError(null);
    };

    const toggleBrandSelectedForGroup = (b) => {
        if (assignedBrandMap.has(b)) return;
        setSelectedForGroup((prev) => {
            const next = new Set(prev);
            if (next.has(b)) next.delete(b);
            else next.add(b);
            return next;
        });
    };

    const commitBrandGroups = (next) => {
        const normalized = normalizeBrandGroups(next);
        setBrandGroups(normalized);
        persistBrandGroups(normalized);
        setSelectedChartKeys((prev) =>
            remapSelectedChartKeys(prev, metricsRows, normalized, normalized.length > 0)
        );
    };

    const selectedUngroupedKeywords = () =>
        [...selectedForGroup].filter((b) => brands.includes(b) && !assignedBrandMap.has(b));

    const addKeywordsToGroup = (groupId, keywordsToAdd) => {
        const toAdd = [...new Set(keywordsToAdd.filter((b) => brands.includes(b)))];
        if (!toAdd.length) return;
        const next = normalizedGroups.map((g) => {
            if (g.id === groupId) {
                return { ...g, brands: [...new Set([...g.brands, ...toAdd])] };
            }
            return { ...g, brands: g.brands.filter((b) => !toAdd.includes(b)) };
        });
        commitBrandGroups(next);
        setSelectedForGroup(new Set());
        setGroupNameDraft("");
    };

    const addSelectionToGroup = (groupId) => {
        addKeywordsToGroup(groupId, selectedUngroupedKeywords());
    };

    const createGroupFromSelection = () => {
        const members = selectedUngroupedKeywords();
        if (members.length < 2) return;
        const name = groupNameDraft.trim() || members[0];
        const stripped = normalizedGroups
            .map((g) => ({
                ...g,
                brands: g.brands.filter((x) => !members.includes(x)),
            }))
            .filter((g) => g.brands.length > 0);
        commitBrandGroups([
            ...stripped,
            { id: newBrandGroupId(), name, brands: members },
        ]);
        setSelectedForGroup(new Set());
        setGroupNameDraft("");
    };

    const dissolveGroup = (groupId) => {
        commitBrandGroups(normalizedGroups.filter((g) => g.id !== groupId));
    };

    const hasKeywordSelection = selectedForGroup.size > 0;

    const handleChartModeChange = (mode) => {
        setChartDisplayMode(mode);
        if (mode === "share") {
            setSelectedChartKeys((prev) => {
                const next = prev.filter((k) => k !== "__total__");
                if (next.length === 0 && displayRows?.length) {
                    return displayRows.map(rowChartKey);
                }
                return next.length ? next : prev;
            });
        }
    };

    const toggleChartKey = (key) => {
        if (chartDisplayMode === "share" && key === "__total__") return;
        setSelectedChartKeys((prev) => {
            if (prev.includes(key)) {
                if (prev.length <= 1) return prev;
                return prev.filter((k) => k !== key);
            }
            return [...prev, key];
        });
    };

    const fetchMetrics = async () => {
        if (!customerId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/share-of-search/${customerId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brands,
                    geoLabel,
                    languageCode: languageCodeForGeo(geoLabel),
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Request failed");
            const rows = data.metrics?.rows || [];
            setMetricsRows(rows);
            setComparisonRanges(data.metrics?.comparisonRanges || null);
            setSelectedChartKeys(
                getDefaultChartKeys(
                    buildDisplayRowsFromBrandGroups(rows, brandGroups, {
                        applyGroups: normalizeBrandGroups(brandGroups).length > 0,
                    }),
                    chartDisplayMode
                )
            );
            await loadHistory();
        } catch (e) {
            setError(e.message || "Something went wrong");
            setMetricsRows(null);
            setSelectedChartKeys([]);
        } finally {
            setLoading(false);
        }
    };

    const reuseSnapshot = (h) => {
        setBrands([...(h.brands || [])]);
        const matched = matchCountryOption(h.geoLabel, countryOptions);
        setGeoLabel(matched?.value ?? (h.geoLabel || "DK"));
        const r = { startDate: h.startDate, endDate: h.endDate };
        setTempRange(r);
        setAppliedRange(r);
        setMetricsRows(h.rows || []);
        setComparisonRanges(null);
        setSelectedChartKeys(
            getDefaultChartKeys(
                buildDisplayRowsFromBrandGroups(h.rows || [], brandGroups, {
                    applyGroups: normalizeBrandGroups(brandGroups).length > 0,
                }),
                chartDisplayMode
            )
        );
        setError(null);
    };

    const loadedFromHistoryWithoutComparisons =
        metricsRows?.length > 0 &&
        !comparisonRanges &&
        metricsRows.some(
            (r) =>
                r.sharePctPreviousPeriod == null &&
                r.sharePctLastYear == null
        );

    const deleteSnapshot = async (snapshotId) => {
        if (!customerId || !snapshotId) return;
        if (!window.confirm("Delete this saved search from history?")) return;
        setDeletingId(String(snapshotId));
        try {
            const res = await fetch(
                `/api/share-of-search/${customerId}?snapshotId=${encodeURIComponent(snapshotId)}`,
                { method: "DELETE" }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Delete failed");
            await loadHistory();
        } catch (e) {
            setError(e.message || "Could not delete");
        } finally {
            setDeletingId(null);
        }
    };

    const monthKeys = useMemo(
        () => monthKeysInRange(appliedRange.startDate, appliedRange.endDate),
        [appliedRange.startDate, appliedRange.endDate]
    );
    const categories = useMemo(() => monthKeys.map(categoryLabel), [monthKeys]);

    const brandLineSeries = useMemo(() => {
        if (!displayRows?.length || !monthKeys.length) return [];
        return displayRows.map((row) => ({
            name: rowChartKey(row),
            label: row.label || row.brand,
            data: seriesForBrand(row, monthKeys),
        }));
    }, [displayRows, monthKeys]);

    const brandColorByKey = useMemo(() => {
        const m = new Map();
        (displayRows || []).forEach((r, i) => {
            m.set(rowChartKey(r), shareOfSearchBrandColor(i));
        });
        return m;
    }, [displayRows]);

    const { chartSeries, chartOptions, chartTitle } = useMemo(() => {
        if (!categories.length) {
            return { chartSeries: [], chartOptions: {}, chartTitle: "" };
        }

        let volumeSeries = [];
        if (chartDisplayMode === "volume" && selectedChartKeys.includes("__total__")) {
            volumeSeries.push({
                name: "Total",
                data: totalSeriesByMonth(brandLineSeries),
            });
        }
        for (const s of brandLineSeries) {
            if (selectedChartKeys.includes(s.name)) {
                volumeSeries.push({
                    chartKey: s.name,
                    name: s.label || s.name,
                    data: [...s.data],
                });
            }
        }

        let series = volumeSeries;
        if (chartDisplayMode === "share") {
            series = toSharePercentSeries(volumeSeries.filter((s) => s.name !== "Total")).map(
                (s, i) => ({
                    ...s,
                    chartKey: volumeSeries.filter((v) => v.name !== "Total")[i]?.chartKey,
                })
            );
        }

        const isShare = chartDisplayMode === "share";
        const title = isShare
            ? series.length === 1
                ? `${series[0].name} share over time`
                : "Share of search over time"
            : series.length === 1
              ? `${series[0].name} over time`
              : "Search volume over time";

        const seriesColors = series.map((s) => {
            if (s.name === "Total") return "#94a3b8";
            const idx = brandLineSeries.findIndex(
                (bs) => bs.name === (s.chartKey || s.name)
            );
            return shareOfSearchBrandColor(idx >= 0 ? idx : 0);
        });

        const stacked = chartVisualMode === "stacked";
        const formatYAxis = (val) =>
            isShare
                ? `${Math.round(Number(val))}%`
                : typeof val === "number" && val >= 1000
                  ? `${Math.round(val / 1000)}k`
                  : String(Math.round(Number(val) || 0));
        const formatTooltipY = (val) =>
            isShare
                ? `${Math.round(Number(val))}%`
                : typeof val === "number"
                  ? Math.round(val).toLocaleString()
                  : val;

        const seriesWithColors = series.map((s, i) => ({
            ...s,
            color: seriesColors[i],
        }));

        const cobaltBase = getCobaltChartBaseOptions();
        const options = {
            ...cobaltBase,
            chart: {
                ...cobaltBase.chart,
                toolbar: { show: false },
                zoom: { enabled: false },
                stacked,
            },
            stroke: { width: 2, curve: "smooth" },
            ...(stacked
                ? {
                      fill: { type: "solid", opacity: 0.72 },
                  }
                : {}),
            markers: { size: stacked ? 0 : 2, hover: { size: stacked ? 5 : 6 } },
            xaxis: {
                ...cobaltBase.xaxis,
                categories,
            },
            legend: { ...cobaltBase.legend, position: "top" },
            colors: seriesColors,
            dataLabels: { enabled: false },
            yaxis: {
                ...cobaltBase.yaxis,
                min: isShare ? 0 : undefined,
                max: isShare ? 100 : undefined,
                labels: {
                    ...cobaltBase.yaxis?.labels,
                    formatter: formatYAxis,
                },
            },
            tooltip: {
                ...cobaltBase.tooltip,
                y: {
                    formatter: formatTooltipY,
                },
            },
        };
        return {
            chartSeries: seriesWithColors,
            chartOptions: options,
            chartTitle: title,
        };
    }, [categories, brandLineSeries, selectedChartKeys, chartDisplayMode, chartVisualMode, displayRows]);

    const totalVolume = useMemo(
        () => (displayRows || []).reduce((s, r) => s + Number(r.volumeInRange || 0), 0),
        [displayRows]
    );

    const shareOfSearchAiSnapshot = useMemo(() => {
        if (!metricsRows?.length) {
            return {
                dashboard: "Share of Search",
                status: "no_data",
                hint: "No Keyword Planner results loaded. Add brands, choose country and dates, then click Fetch data.",
            };
        }
        return {
            dashboard: "Share of Search",
            dataSource: "Google Ads Keyword Planner (historical search volumes)",
            country: countryValue?.label || geoLabel,
            countryCode: isWorldwideGeoValue(geoLabel) ? null : geoLabel,
            period: {
                startDate: appliedRange.startDate,
                endDate: appliedRange.endDate,
            },
            chartView:
                chartDisplayMode === "share"
                    ? "Share of search (percentage of compared brands)"
                    : "Search volume (absolute)",
            totalSearchVolumeInPeriod: totalVolume,
            groupedView: applyBrandGroupsInCharts,
            brandGroups: brandGroups.map((g) => ({ name: g.name, brands: g.brands })),
            brandsAnalyzed: displayRows.map((r) => ({
                brand: r.label || r.brand,
                isGroup: Boolean(r.isGroup),
                memberBrands: r.memberBrands,
                keywordPlanText: r.apiKeywordText,
                shareOfSearchPercent: r.sharePct,
                volumeInPeriod: r.volumeInRange,
                sharePctPreviousPeriod: r.sharePctPreviousPeriod,
                sharePctLastYear: r.sharePctLastYear,
            })),
            keywordsFetched: (metricsRows || []).map((r) => ({
                brand: r.brand,
                keywordPlanText: r.apiKeywordText,
                volumeInPeriod: r.volumeInRange,
            })),
            fieldGuide: {
                shareOfSearchPercent:
                    "Each brand's % of the sum of all listed brands' volumes in the period (not entire market).",
                sharePctPreviousPeriod: "Same share metric for the prior equal-length period.",
                sharePctLastYear: "Same share metric for dates one calendar year earlier.",
            },
        };
    }, [
        metricsRows,
        displayRows,
        brandGroups,
        applyBrandGroupsInCharts,
        appliedRange.startDate,
        appliedRange.endDate,
        chartDisplayMode,
        geoLabel,
        countryValue,
        totalVolume,
    ]);

    return (
        <div id="ShareOfSearchPage" className="apex-perf w-full apex-sos-stack">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Share of Search"
                label={customer?.customerName || "Customer"}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod="Last Period"
                showPdfExport={false}
                showAnalyzeWithAi
                dashboardType="share-of-search"
                dataSnapshot={shareOfSearchAiSnapshot}
                loading={loading}
                right={
                    <DateRangePicker
                        variant="cobalt"
                        usePortal
                        onApply={handleApplyRange}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={(v) => setTempRange((r) => ({ ...r, startDate: v }))}
                        onEndDateChange={(v) => setTempRange((r) => ({ ...r, endDate: v }))}
                        loading={loading}
                        showComparisonMethodToggler={false}
                        customPresets={shareOfSearchDatePresets}
                    />
                }
            />

            <section className="apex-sos-setup">
                <div className="apex-sos-keywords-block">
                    <div className="apex-sos-keywords-block__head">
                        <label className="apex-sos-field__label mb-0">Keywords</label>
                        {groupsSaving && (
                            <span className="text-xs text-[var(--color-muted)]">Saving…</span>
                        )}
                    </div>

                    <div className="apex-sos-brand-list apex-sos-brand-list--stack">
                        {normalizedGroups.map((g) => (
                            <div key={g.id} className="apex-sos-brand-cluster">
                                {hasKeywordSelection ? (
                                    <button
                                        type="button"
                                        className={cn(
                                            "apex-sos-brand-chip apex-sos-brand-chip--group",
                                            "apex-sos-brand-chip--group-add"
                                        )}
                                        onClick={() => addSelectionToGroup(g.id)}
                                        title={`Add selected keyword(s) to ${g.name}`}
                                    >
                                        <FiPlus className="w-3.5 h-3.5 shrink-0" aria-hidden />
                                        <FiLayers className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                                        {g.name}
                                    </button>
                                ) : (
                                    <span className="apex-sos-brand-chip apex-sos-brand-chip--group">
                                        <FiLayers className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                                        {g.name}
                                        <button
                                            type="button"
                                            className="apex-sos-brand-chip__remove"
                                            onClick={() => dissolveGroup(g.id)}
                                            aria-label={`Ungroup ${g.name}`}
                                            title="Ungroup"
                                        >
                                            <FiTrash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                )}
                                <div className="apex-sos-brand-cluster__members">
                                    {g.brands.map((b) => (
                                        <span key={b} className="apex-sos-brand-chip apex-sos-brand-chip--nested">
                                            {b}
                                            <button
                                                type="button"
                                                className="apex-sos-brand-chip__remove"
                                                onClick={() => removeBrand(b)}
                                                aria-label={`Remove ${b}`}
                                            >
                                                <FiTrash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                    {!hasKeywordSelection &&
                                        ungroupedBrands.map((b) => (
                                            <button
                                                key={`${g.id}-add-${b}`}
                                                type="button"
                                                className="apex-sos-brand-chip apex-sos-brand-chip--nested apex-sos-brand-chip--add-member"
                                                onClick={() => addKeywordsToGroup(g.id, [b])}
                                                title={`Add ${b} to ${g.name}`}
                                            >
                                                <FiPlus className="w-3 h-3 shrink-0" aria-hidden />
                                                {b}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        ))}
                        {ungroupedBrands.map((b) => (
                            <button
                                key={b}
                                type="button"
                                className={cn(
                                    "apex-sos-brand-chip apex-sos-brand-chip--selectable",
                                    selectedForGroup.has(b) && "is-selected"
                                )}
                                onClick={() => toggleBrandSelectedForGroup(b)}
                                title="Click to select for grouping"
                                aria-label={`${b}. Click to select for grouping.`}
                            >
                                <FiLink2
                                    className="apex-sos-brand-chip__group-hint w-3 h-3 shrink-0 opacity-55"
                                    aria-hidden
                                />
                                {b}
                                <span
                                    role="button"
                                    tabIndex={0}
                                    className="apex-sos-brand-chip__remove"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeBrand(b);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.stopPropagation();
                                            removeBrand(b);
                                        }
                                    }}
                                    aria-label={`Remove ${b}`}
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" />
                                </span>
                            </button>
                        ))}
                    </div>

                    {hasKeywordSelection && (
                        <div className="apex-sos-group-bar">
                            {normalizedGroups.length > 0 && (
                                <div className="apex-sos-group-bar__existing">
                                    <span className="text-xs font-medium text-[var(--color-muted)] shrink-0">
                                        Add to:
                                    </span>
                                    {normalizedGroups.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            className="apex-sos-btn apex-sos-btn--sm"
                                            onClick={() => addSelectionToGroup(g.id)}
                                        >
                                            {g.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {selectedForGroup.size >= 2 && (
                                <div className="apex-sos-group-bar__new flex flex-wrap items-center gap-2 w-full">
                                    <input
                                        type="text"
                                        className="apex-sos-input flex-1 min-w-[10rem]"
                                        placeholder="New group name (optional)"
                                        value={groupNameDraft}
                                        onChange={(e) => setGroupNameDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                createGroupFromSelection();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="apex-sos-btn apex-sos-btn--primary"
                                        onClick={createGroupFromSelection}
                                    >
                                        New group ({selectedForGroup.size})
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                className="apex-sos-btn apex-sos-btn--sm ml-auto"
                                onClick={() => {
                                    setSelectedForGroup(new Set());
                                    setGroupNameDraft("");
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    <div className="apex-sos-add-row">
                        <input
                            type="text"
                            className="apex-sos-input"
                            placeholder="Type a keyword and press Enter…"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addBrand();
                                }
                            }}
                        />
                        <button
                            type="button"
                            className="apex-sos-btn apex-sos-btn--primary apex-sos-btn--icon"
                            onClick={addBrand}
                            aria-label="Add keyword"
                        >
                            <FiPlus className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-[var(--color-muted)] mt-2">
                        Select keywords (link icon) to add them to an existing group or create a new one.
                        You can also use the + chips on a group. Each keyword is still fetched separately.
                    </p>
                </div>

                <div className="apex-sos-setup__row">
                    <div className="flex-1 min-w-0">
                        <label className="apex-sos-field__label" htmlFor="sos-country">
                            Country
                        </label>
                        <Select
                            inputId="sos-country"
                            instanceId="sos-country"
                            options={countryOptions}
                            value={countryValue}
                            onChange={(opt) => setGeoLabel(opt?.value ?? "DK")}
                            isSearchable
                            isClearable={false}
                            placeholder="Search country…"
                            styles={COUNTRY_SELECT_STYLES}
                            className="text-sm"
                        />
                    </div>
                    <div className="apex-sos-setup__actions">
                        <button
                            type="button"
                            className="apex-sos-btn"
                            disabled={loading || (brands.length === 0 && !draft.trim())}
                            onClick={clearBrands}
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            className="apex-sos-btn apex-sos-btn--primary"
                            disabled={loading || brands.length === 0}
                            onClick={fetchMetrics}
                        >
                            <FiRefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            Fetch data
                        </button>
                    </div>
                </div>

                {error && <p className="apex-sos-alert">{error}</p>}

                <p className="apex-sos-help text-sm text-[var(--color-muted)] leading-relaxed mt-3">
                    Data comes from{" "}
                    <strong className="font-medium text-[var(--color-ink)]">
                        Google Ads Keyword Planner
                    </strong>{" "}
                    (Google Search network). Each brand is sent as a keyword; we use the matched
                    idea’s monthly search volumes in your selected country and date range. Share of
                    Search is each brand’s % of the <em>sum of the brands you listed</em> — not the
                    whole market.
                </p>
            </section>

            {loadedFromHistoryWithoutComparisons && (
                <p className="apex-sos-alert">
                    Loaded from history — click <strong>Fetch data</strong> again to refresh period
                    comparisons (last period / last year).
                </p>
            )}

            {metricsRows && metricsRows.length > 0 && (
                <>
                    <section>
                        <h3 className="apex-sos-section__label">Brand metrics</h3>
                        {comparisonRanges?.note && (
                            <p className="text-sm text-[var(--color-muted)] mb-3 leading-relaxed">
                                {comparisonRanges.note}
                            </p>
                        )}
                        {(comparisonRanges?.previousPeriod?.ok ||
                            comparisonRanges?.lastYear?.ok) && (
                            <p className="text-xs text-[var(--color-muted)] mb-3 leading-relaxed">
                                {comparisonRanges?.previousPeriod?.ok && (
                                    <>
                                        <span className="font-medium text-[var(--color-ink)]">
                                            Prior period:{" "}
                                        </span>
                                        {formatComparisonRange(comparisonRanges.previousPeriod)}
                                    </>
                                )}
                                {comparisonRanges?.previousPeriod?.ok &&
                                    comparisonRanges?.lastYear?.ok &&
                                    !comparisonRanges?.rangesEqual && (
                                        <span className="mx-2">·</span>
                                    )}
                                {comparisonRanges?.lastYear?.ok &&
                                    !comparisonRanges?.rangesEqual && (
                                        <>
                                            <span className="font-medium text-[var(--color-ink)]">
                                                Last year:{" "}
                                            </span>
                                            {formatComparisonRange(comparisonRanges.lastYear)}
                                        </>
                                    )}
                            </p>
                        )}
                        <div className="apex-sos-kpi-grid">
                        {chartDisplayMode === "volume" && (
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleChartKey("__total__")}
                                onKeyDown={(e) =>
                                    (e.key === "Enter" || e.key === " ") && toggleChartKey("__total__")
                                }
                                className="apex-sos-kpi-card"
                            >
                                <MetricCard
                                    variant="cobalt"
                                    label="Total search volume"
                                    value={totalVolume.toLocaleString()}
                                    icon={<FiLayers />}
                                    isActive={selectedChartKeys.includes("__total__")}
                                    comparisonMethod={null}
                                    hideIconBackdrop
                                    className="h-full"
                                />
                            </div>
                        )}
                        {displayRows.map((row) => {
                            const chartKey = rowChartKey(row);
                            return (
                            <div
                                key={chartKey}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleChartKey(chartKey)}
                                onKeyDown={(e) =>
                                    (e.key === "Enter" || e.key === " ") && toggleChartKey(chartKey)
                                }
                                className="apex-sos-kpi-card"
                            >
                                <MetricCard
                                    variant="cobalt"
                                    label={
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                                                style={{
                                                    backgroundColor:
                                                        brandColorByKey.get(chartKey) ??
                                                        shareOfSearchBrandColor(0),
                                                }}
                                                aria-hidden
                                            />
                                            <span className="truncate">{row.label || row.brand}</span>
                                        </span>
                                    }
                                    value={`${row.sharePct}%`}
                                    subCaption={
                                        <div className="flex flex-col gap-1 leading-snug">
                                            {row.isGroup && (
                                                <span className="text-[var(--color-muted)]">
                                                    {row.memberBrands?.length || 0} keywords grouped
                                                </span>
                                            )}
                                            <span>
                                                volume:{" "}
                                                {Number(row.volumeInRange || 0).toLocaleString()}
                                            </span>
                                            <span>
                                                SoS % prior period:{" "}
                                                {formatSharePctValue(row.sharePctPreviousPeriod)}
                                            </span>
                                            {!comparisonRanges?.rangesEqual && (
                                                <span>
                                                    SoS % YoY (last year):{" "}
                                                    {formatSharePctValue(row.sharePctLastYear)}
                                                </span>
                                            )}
                                        </div>
                                    }
                                    icon={<FiTrendingUp />}
                                    isActive={selectedChartKeys.includes(chartKey)}
                                    comparisonMethod={null}
                                    hideIconBackdrop
                                    className="h-full"
                                />
                            </div>
                            );
                        })}
                        </div>
                    </section>

                    <section>
                        <h3 className="apex-sos-section__label">Trend chart</h3>
                        <div className="apex-sos-chart-block">
                        <div className="apex-sos-tab-group">
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartDisplayMode === "share" && "is-active")}
                                onClick={() => handleChartModeChange("share")}
                            >
                                Share of search
                            </button>
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartDisplayMode === "volume" && "is-active")}
                                onClick={() => handleChartModeChange("volume")}
                            >
                                Search volume
                            </button>
                            <span className="apex-sos-tab-divider hidden sm:block" aria-hidden />
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartVisualMode === "stacked" && "is-active")}
                                onClick={() => setChartVisualMode("stacked")}
                            >
                                Stacked
                            </button>
                            <button
                                type="button"
                                className={cn("apex-sos-tab", chartVisualMode === "lines" && "is-active")}
                                onClick={() => setChartVisualMode("lines")}
                            >
                                Lines
                            </button>
                        </div>
                        {loading ? (
                            <div className="apex-sos-chart-empty">
                                <CobaltLoader variant="inline" title="Loading chart data" />
                            </div>
                        ) : chartSeries.length > 0 ? (
                            <GraphCard
                                variant="cobalt"
                                key={`sos-chart-${chartVisualMode}`}
                                title={chartTitle}
                                chartType={chartVisualMode === "stacked" ? "area" : "line"}
                                chartOptions={chartOptions}
                                chartSeries={chartSeries}
                                height={360}
                                hideChartToggle
                            />
                        ) : (
                            <p className="apex-sos-chart-empty">
                                Select at least one metric to show the chart.
                            </p>
                        )}
                        </div>
                    </section>

                    <section className="apex-sos-table-panel">
                        <div className="apex-sos-table-panel__head">
                            <h3 className="apex-sos-table-panel__title">
                                {applyBrandGroupsInCharts ? "Grouped results" : "Results"}
                            </h3>
                            <p className="apex-sos-table-panel__subtitle">
                                {applyBrandGroupsInCharts
                                    ? "Combined volumes and share % per brand group."
                                    : "Keyword Planner volumes and share for the selected period."}
                            </p>
                        </div>
                        <div className="apex-sos-table-wrap">
                        <table className="apex-sos-table">
                            <thead>
                                <tr>
                                    <th>Brand</th>
                                    <th>Keywords</th>
                                    <th className="is-num">Volume in range</th>
                                    <th className="is-num">Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRows.map((r) => (
                                    <tr key={rowChartKey(r)}>
                                        <td className="is-brand">{r.label || r.brand}</td>
                                        <td className="is-muted">
                                            {r.isGroup
                                                ? (r.memberBrands || []).join(", ")
                                                : r.apiKeywordText}
                                        </td>
                                        <td className="is-num">
                                            {Number(r.volumeInRange || 0).toLocaleString()}
                                        </td>
                                        <td className="is-num">{r.sharePct}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </section>

                    <section className="apex-sos-table-panel">
                        <div className="apex-sos-table-panel__head">
                            <h3 className="apex-sos-table-panel__title">All keywords fetched</h3>
                            <p className="apex-sos-table-panel__subtitle">
                                One row per search term sent to Keyword Planner (before grouping).
                            </p>
                        </div>
                        <div className="apex-sos-table-wrap">
                        <table className="apex-sos-table">
                            <thead>
                                <tr>
                                    <th>Keyword</th>
                                    <th>Matched in API</th>
                                    <th className="is-num">Volume in range</th>
                                    <th className="is-num">Share (ungrouped)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {metricsRows.map((r) => (
                                    <tr key={r.brand}>
                                        <td className="is-brand">{r.brand}</td>
                                        <td className="is-muted">{r.apiKeywordText}</td>
                                        <td className="is-num">
                                            {Number(r.volumeInRange || 0).toLocaleString()}
                                        </td>
                                        <td className="is-num">{r.sharePct}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </section>
                </>
            )}

            <section className="apex-sos-table-panel">
                <div className="apex-sos-table-panel__head">
                    <h2 className="apex-sos-table-panel__title">History</h2>
                    <p className="apex-sos-table-panel__subtitle">
                        Previously saved searches. Load one to restore settings and results, or delete it.
                    </p>
                </div>
                {historyLoading ? (
                    <div className="apex-sos-loading">
                        <CobaltLoader variant="inline" title="Loading history" />
                    </div>
                ) : history.length === 0 ? (
                    <p className="apex-sos-empty">No saved searches yet. Fetch data to create one.</p>
                ) : (
                    <div className="apex-sos-table-wrap">
                        <table className="apex-sos-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Brands</th>
                                    <th>Country</th>
                                    <th>Period</th>
                                    <th className="is-num">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={String(h._id)}>
                                        <td className="whitespace-nowrap">
                                            {h.createdAt
                                                ? dayjs(h.createdAt).format("YYYY-MM-DD HH:mm")
                                                : "—"}
                                        </td>
                                        <td>{(h.brands || []).join(", ")}</td>
                                        <td>{h.geoLabel}</td>
                                        <td className="is-muted whitespace-nowrap">
                                            {h.startDate} → {h.endDate}
                                        </td>
                                        <td className="is-num">
                                            <div className="apex-sos-table__actions">
                                                <button
                                                    type="button"
                                                    className="apex-sos-btn apex-sos-btn--sm"
                                                    onClick={() => reuseSnapshot(h)}
                                                >
                                                    <FiRotateCcw className="w-3.5 h-3.5" />
                                                    Load
                                                </button>
                                                <button
                                                    type="button"
                                                    className="apex-sos-btn apex-sos-btn--sm apex-sos-btn--danger"
                                                    disabled={deletingId === String(h._id)}
                                                    onClick={() => deleteSnapshot(h._id)}
                                                >
                                                    {deletingId === String(h._id) ? (
                                                        <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <FiTrash2 className="w-3.5 h-3.5" />
                                                    )}
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
