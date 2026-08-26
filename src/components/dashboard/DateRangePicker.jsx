"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import dayjs from "dayjs";
import { FiCheck } from "react-icons/fi";
import {
    DATE_FORMAT,
    DATE_RANGE_PRESETS,
    COMPARE_PRESETS,
    detectDateRangePresetId,
    comparisonMethodToPresetId,
    presetIdToComparisonMethod,
    getComparisonPreviewRange,
    isValidDateRange,
    formatRangeLabel,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";

function toDate(str) {
    if (!str || typeof str !== "string") return null;
    const d = dayjs(str, DATE_FORMAT);
    return d.isValid() ? d.toDate() : null;
}

function toStr(date) {
    if (!date) return "";
    return dayjs(date).format(DATE_FORMAT);
}

/** Legacy presets for month-only mode and customPresets override. */
const LEGACY_PRESETS = [
    { label: "Today", getRange: () => ({ start: dayjs(), end: dayjs() }) },
    {
        label: "Yesterday",
        getRange: () => ({
            start: dayjs().subtract(1, "day"),
            end: dayjs().subtract(1, "day"),
        }),
    },
    {
        label: "Last 7 days",
        getRange: () => ({
            start: dayjs().subtract(6, "day"),
            end: dayjs(),
        }),
    },
    {
        label: "Last 30 days",
        getRange: () => ({
            start: dayjs().subtract(29, "day"),
            end: dayjs(),
        }),
    },
    {
        label: "This month",
        getRange: () => {
            const today = dayjs();
            const isFirst = today.date() === 1;
            return {
                start: today.startOf("month"),
                end: isFirst ? today : today.subtract(1, "day"),
            };
        },
    },
    {
        label: "Last month",
        getRange: () => {
            const lastMonth = dayjs().subtract(1, "month");
            return {
                start: lastMonth.startOf("month"),
                end: lastMonth.endOf("month"),
            };
        },
    },
];

const MONTH_PRESETS = [
    {
        label: "This month",
        getRange: () => {
            const today = dayjs();
            const isFirst = today.date() === 1;
            return {
                start: today.startOf("month"),
                end: isFirst ? today : today.subtract(1, "day"),
            };
        },
    },
    {
        label: "Last month",
        getRange: () => ({
            start: dayjs().subtract(1, "month").startOf("month"),
            end: dayjs().subtract(1, "month").endOf("month"),
        }),
    },
    {
        label: "2 months ago",
        getRange: () => ({
            start: dayjs().subtract(2, "month").startOf("month"),
            end: dayjs().subtract(2, "month").endOf("month"),
        }),
    },
    {
        label: "3 months ago",
        getRange: () => ({
            start: dayjs().subtract(3, "month").startOf("month"),
            end: dayjs().subtract(3, "month").endOf("month"),
        }),
    },
];

function PresetList({ title, presets, activeId, onSelect, disabled, isApex = false }) {
    return (
        <div className="p-3 min-w-0">
            <div className={`mb-2 px-2 ${isApex ? "text-xs font-medium text-[var(--color-muted)]" : "text-[11px] uppercase tracking-wider text-gray-500"}`}>
                {title}
            </div>
            <ul className="space-y-0.5">
                {presets.map((preset) => {
                    const active = activeId === preset.id;
                    return (
                        <li key={preset.id}>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onSelect(preset.id)}
                                className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                                    active
                                        ? "bg-gray-100 text-gray-900 font-medium"
                                        : "text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                <span>{preset.label}</span>
                                {active ? (
                                    <FiCheck className={`h-3.5 w-3.5 shrink-0 ${isApex ? "text-[var(--color-ink)]" : "text-[var(--color-primary-searchmind)]"}`} aria-hidden />
                                ) : (
                                    <span className="w-3.5 shrink-0" aria-hidden />
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function MonthCustomModeToggle({ mode, onChange, isApex, disabled }) {
    const segmentClass = isApex ? "apex-perf-segment" : "flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden";
    const btnClass = (active) =>
        isApex
            ? `apex-perf-segment__btn${active ? " is-active" : ""}`
            : `text-nowrap flex-1 px-2 py-1 text-xs font-medium focus:outline-none transition-colors duration-150 disabled:opacity-50 ${
                  active
                      ? "bg-white text-[var(--color-primary-searchmind)] shadow-sm"
                      : "text-gray-500 hover:text-[var(--color-primary-searchmind)]"
              }`;

    return (
        <div className="px-3 pt-3 pb-2 border-b border-gray-200">
            <div className={segmentClass} role="group" aria-label="Date selection mode">
                <button
                    type="button"
                    className={btnClass(mode === "month")}
                    disabled={disabled}
                    onClick={() => onChange("month")}
                >
                    Month
                </button>
                <button
                    type="button"
                    className={btnClass(mode === "custom")}
                    disabled={disabled}
                    onClick={() => onChange("custom")}
                >
                    Custom
                </button>
            </div>
        </div>
    );
}

function InlineRangeCalendar({
    startDate,
    endDate,
    onChange,
    loading,
    helperText,
}) {
    const startDateObj = toDate(startDate);
    const endDateObj = toDate(endDate);
    return (
        <div className="px-2 pb-2">
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <DatePicker
                    selected={startDateObj}
                    startDate={startDateObj}
                    endDate={endDateObj}
                    onChange={onChange}
                    selectsRange
                    inline
                    dateFormat={DATE_FORMAT}
                    disabled={loading}
                />
                {helperText ? (
                    <p className="text-[11px] text-gray-500 px-3 py-2 border-t border-gray-100">
                        {helperText}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

export default function DateRangePicker({
    onApply,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    loading,
    showComparisonMethodToggler = false,
    comparisonMethod = COMPARISON_METHOD.LAST_YEAR,
    onComparisonMethodChange,
    compareStartDate = "",
    compareEndDate = "",
    onCompareStartDateChange,
    onCompareEndDateChange,
    monthOnly = false,
    monthCustomToggle = false,
    customPresets = null,
    usePortal = false,
    triggerClassName = "",
    variant = "default",
}) {
    const isApex = variant === "cobalt" || variant === "apex";
    const [isOpen, setIsOpen] = useState(false);
    const [monthCustomMode, setMonthCustomMode] = useState("month");
    const [portalStyle, setPortalStyle] = useState({ top: 0, right: 0 });
    const [rangePresetId, setRangePresetId] = useState("mtd");
    const [comparePresetId, setComparePresetId] = useState("yoy");
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    const portalContentRef = useRef(null);

    const effectiveMonthOnly = monthCustomToggle
        ? monthCustomMode === "month"
        : monthOnly;
    const useLegacyLayout =
        monthCustomToggle || monthOnly || (customPresets?.length ?? 0) > 0;
    const useModernLayout = !useLegacyLayout;

    const syncDraftPresetsFromProps = useCallback(() => {
        setRangePresetId(detectDateRangePresetId(startDate, endDate));
        setComparePresetId(comparisonMethodToPresetId(comparisonMethod));
    }, [startDate, endDate, comparisonMethod]);

    useEffect(() => {
        if (isOpen) syncDraftPresetsFromProps();
    }, [isOpen, syncDraftPresetsFromProps]);

    const startDateObj = toDate(startDate);
    const endDateObj = toDate(endDate);

    const updatePortalPosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPortalStyle({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }, []);

    useLayoutEffect(() => {
        if (!isOpen || !usePortal) return;
        updatePortalPosition();
        const t = requestAnimationFrame(updatePortalPosition);
        return () => cancelAnimationFrame(t);
    }, [isOpen, usePortal, updatePortalPosition]);

    useEffect(() => {
        if (!isOpen || !usePortal) return;
        const onScrollOrResize = () => updatePortalPosition();
        window.addEventListener("resize", onScrollOrResize);
        document.addEventListener("scroll", onScrollOrResize, true);
        return () => {
            window.removeEventListener("resize", onScrollOrResize);
            document.removeEventListener("scroll", onScrollOrResize, true);
        };
    }, [isOpen, usePortal, updatePortalPosition]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (usePortal) {
                if (triggerRef.current?.contains(e.target)) return;
                if (portalContentRef.current?.contains(e.target)) return;
            } else if (popoverRef.current?.contains(e.target)) {
                return;
            }
            setIsOpen(false);
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen, usePortal]);

    const handleRangeChange = (dates) => {
        const [start, end] = dates;
        onStartDateChange?.(toStr(start));
        onEndDateChange?.(toStr(end));
    };

    const handleCompareChange = (dates) => {
        const [start, end] = dates;
        onCompareStartDateChange?.(toStr(start));
        onCompareEndDateChange?.(toStr(end));
    };

    const handleMonthChange = (date) => {
        if (!date) return;
        const d = dayjs(date);
        const today = dayjs();
        const start = d.startOf("month").format(DATE_FORMAT);
        const end = d.isSame(today, "month")
            ? (today.date() === 1 ? today : today.subtract(1, "day")).format(DATE_FORMAT)
            : d.endOf("month").format(DATE_FORMAT);
        onStartDateChange?.(start);
        onEndDateChange?.(end);
    };

    const handleMonthCustomModeChange = (mode) => {
        setMonthCustomMode(mode);
        if (mode === "month" && startDateObj) {
            handleMonthChange(startDateObj);
        }
    };

    const applyRangePreset = (presetId) => {
        setRangePresetId(presetId);
        if (presetId === "custom") return;
        const preset = DATE_RANGE_PRESETS.find((p) => p.id === presetId);
        if (!preset?.getRange) return;
        const { start, end } = preset.getRange();
        onStartDateChange?.(start.format(DATE_FORMAT));
        onEndDateChange?.(end.format(DATE_FORMAT));
    };

    const applyComparePreset = (presetId) => {
        setComparePresetId(presetId);
        const method = presetIdToComparisonMethod(presetId);
        onComparisonMethodChange?.(method);
        if (presetId !== "custom") {
            onCompareStartDateChange?.("");
            onCompareEndDateChange?.("");
        }
    };

    const handleLegacyPreset = (preset) => {
        const { start, end } = preset.getRange();
        onStartDateChange?.(start.format(DATE_FORMAT));
        onEndDateChange?.(end.format(DATE_FORMAT));
    };

    const canApply = useMemo(() => {
        if (loading) return false;
        if (useModernLayout) {
            if (rangePresetId === "custom" && !isValidDateRange(startDate, endDate)) {
                return false;
            }
            if (
                showComparisonMethodToggler &&
                comparePresetId === "custom" &&
                !isValidDateRange(compareStartDate, compareEndDate)
            ) {
                return false;
            }
            return true;
        }
        if (effectiveMonthOnly) return Boolean(startDate && endDate);
        return isValidDateRange(startDate, endDate);
    }, [
        loading,
        useModernLayout,
        rangePresetId,
        startDate,
        endDate,
        showComparisonMethodToggler,
        comparePresetId,
        compareStartDate,
        compareEndDate,
        effectiveMonthOnly,
    ]);

    const handleApply = () => {
        if (!canApply) return;
        setIsOpen(false);
        const method = showComparisonMethodToggler
            ? presetIdToComparisonMethod(comparePresetId)
            : undefined;
        onApply?.({
            startDate,
            endDate,
            comparisonMethod: method,
            compareStartDate:
                method === COMPARISON_METHOD.CUSTOM ? compareStartDate : undefined,
            compareEndDate:
                method === COMPARISON_METHOD.CUSTOM ? compareEndDate : undefined,
        });
    };

    const comparePreview = useMemo(() => {
        if (!showComparisonMethodToggler) return null;
        return getComparisonPreviewRange({
            comparisonMethod: presetIdToComparisonMethod(comparePresetId),
            startDate,
            endDate,
            compareStartDate,
            compareEndDate,
        });
    }, [
        showComparisonMethodToggler,
        comparePresetId,
        startDate,
        endDate,
        compareStartDate,
        compareEndDate,
    ]);

    const displayText = formatRangeLabel(startDate, endDate);

    const legacyPresetList = effectiveMonthOnly
        ? MONTH_PRESETS
        : customPresets?.length
          ? customPresets
          : LEGACY_PRESETS;

    const applyButton = (
        <div className="flex justify-end border-t border-gray-200 px-3 py-2 bg-gray-50/50">
            <button
                type="button"
                onClick={handleApply}
                disabled={!canApply}
                className={isApex
                    ? "apex-perf-btn apex-perf-btn--primary text-xs !min-h-[2rem] px-4"
                    : "text-xs px-4 py-2 rounded-lg text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)] disabled:opacity-50 disabled:cursor-not-allowed"}
            >
                Apply
            </button>
        </div>
    );

    const modernDropdownInner = showComparisonMethodToggler ? (
        <div className="w-[min(680px,calc(100vw-1.5rem))]">
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                <div className="min-w-0">
                    <PresetList
                        title="Date range"
                        presets={DATE_RANGE_PRESETS}
                        activeId={rangePresetId}
                        onSelect={applyRangePreset}
                        disabled={loading}
                        isApex={isApex}
                    />
                    {rangePresetId === "custom" ? (
                        <InlineRangeCalendar
                            startDate={startDate}
                            endDate={endDate}
                            onChange={handleRangeChange}
                            loading={loading}
                            helperText="Select a start and end date"
                        />
                    ) : null}
                </div>
                <div className="min-w-0">
                    <PresetList
                        title="Compare to"
                        presets={COMPARE_PRESETS}
                        activeId={comparePresetId}
                        onSelect={applyComparePreset}
                        disabled={loading}
                        isApex={isApex}
                    />
                    {comparePresetId === "custom" ? (
                        <InlineRangeCalendar
                            startDate={compareStartDate}
                            endDate={compareEndDate}
                            onChange={handleCompareChange}
                            loading={loading}
                            helperText="Select comparison start and end date"
                        />
                    ) : null}
                </div>
            </div>
            <div className="border-t border-gray-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-gray-500">
                <span>
                    <span className="text-gray-800 font-medium">{startDate || "—"}</span>
                    {" → "}
                    <span className="text-gray-800 font-medium">{endDate || "—"}</span>
                </span>
                {comparePreview ? (
                    <span>
                        vs{" "}
                        <span className="text-gray-800 font-medium">
                            {comparePreview.startDate}
                        </span>
                        {" → "}
                        <span className="text-gray-800 font-medium">
                            {comparePreview.endDate}
                        </span>
                    </span>
                ) : comparePresetId === "none" ? (
                    <span className="text-gray-400">No comparison</span>
                ) : null}
            </div>
            {applyButton}
        </div>
    ) : (
        <div className="w-[min(400px,calc(100vw-1.5rem))]">
            <PresetList
                title="Date range"
                presets={DATE_RANGE_PRESETS}
                activeId={rangePresetId}
                onSelect={applyRangePreset}
                disabled={loading}
                isApex={isApex}
            />
            {rangePresetId === "custom" ? (
                <InlineRangeCalendar
                    startDate={startDate}
                    endDate={endDate}
                    onChange={handleRangeChange}
                    loading={loading}
                    helperText="Select a start and end date"
                />
            ) : null}
            {applyButton}
        </div>
    );

    const legacyDropdownInner = (
        <>
            {monthCustomToggle ? (
                <MonthCustomModeToggle
                    mode={monthCustomMode}
                    onChange={handleMonthCustomModeChange}
                    isApex={isApex}
                    disabled={loading}
                />
            ) : null}
            <span className="flex flex-row gap-2">
            <div className="p-3 w-full">
                <div className="text-xs font-medium text-gray-500 mb-2">Presets</div>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {legacyPresetList.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => handleLegacyPreset(preset)}
                            disabled={loading}
                            className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 w-full text-nowrap text-left"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
                {showComparisonMethodToggler && !useModernLayout ? (
                    <div className="mt-3 pt-3">
                        <div className="text-xs font-medium text-gray-500 mb-2">Comparison</div>
                        <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                    onComparisonMethodChange?.(COMPARISON_METHOD.LAST_YEAR)
                                }
                                className={`text-nowrap flex-1 px-2 py-1 text-xs font-medium focus:outline-none transition-colors duration-150 ${comparisonMethod === COMPARISON_METHOD.LAST_YEAR ? "bg-white text-[var(--color-primary-searchmind)] shadow-sm" : "text-gray-500 hover:text-[var(--color-primary-searchmind)]"}`}
                                style={{ borderRadius: "6px 0 0 6px" }}
                            >
                                Last Year
                            </button>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                    onComparisonMethodChange?.(COMPARISON_METHOD.LAST_PERIOD)
                                }
                                className={`text-nowrap flex-1 px-2 py-1 text-xs font-medium focus:outline-none transition-colors duration-150 ${comparisonMethod === COMPARISON_METHOD.LAST_PERIOD ? "bg-white text-[var(--color-primary-searchmind)] shadow-sm" : "text-gray-500 hover:text-[var(--color-primary-searchmind)]"}`}
                                style={{ borderRadius: "0 6px 6px 0" }}
                            >
                                Last Period
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
            <span className="relative">
                <div className="flex flex-col justify-between h-auto p-2">
                    <div className="text-xs font-medium text-gray-500 mb-2">
                        {effectiveMonthOnly ? "Month" : "Date Range"}
                    </div>
                    {effectiveMonthOnly ? (
                        <DatePicker
                            selected={startDateObj}
                            onChange={handleMonthChange}
                            showMonthYearPicker
                            inline
                            dateFormat="yyyy-MM"
                            disabled={loading}
                        />
                    ) : (
                        <DatePicker
                            selected={startDateObj}
                            startDate={startDateObj}
                            endDate={endDateObj}
                            onChange={handleRangeChange}
                            selectsRange
                            inline
                            dateFormat={DATE_FORMAT}
                            disabled={loading}
                        />
                    )}
                </div>
                <div className="flex justify-end px-2 pb-2">
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={!canApply}
                        className="mt-1 text-xs px-4 py-2 rounded-lg text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Apply
                    </button>
                </div>
            </span>
        </span>
        </>
    );

    const dropdownInner = useModernLayout ? modernDropdownInner : legacyDropdownInner;

    const portalNode =
        isOpen &&
        usePortal &&
        typeof document !== "undefined" &&
        createPortal(
            <div
                ref={portalContentRef}
                className={`fixed z-[10000] overflow-hidden ${effectiveMonthOnly ? "datepicker-monthly" : ""} ${isApex ? "apex-perf-date-panel" : "bg-white border border-gray-200 rounded-lg shadow-lg"}`}
                style={{ top: portalStyle.top, right: portalStyle.right }}
            >
                {dropdownInner}
            </div>,
            document.body
        );

    return (
        <div className="flex items-center gap-2 flex-wrap" ref={!usePortal ? popoverRef : null}>
            <div className="relative">
                <button
                    ref={triggerRef}
                    id="date-range-picker-button"
                    type="button"
                    onClick={() => !loading && setIsOpen((o) => !o)}
                    disabled={loading}
                    className={isApex
                        ? `apex-perf-date-trigger text-nowrap text-center w-full min-w-[50px] disabled:opacity-50 disabled:cursor-not-allowed${triggerClassName ? ` ${triggerClassName}` : ""}`
                        : `text-nowrap text-center border border-gray-200 rounded-lg px-3 py-2 text-xs w-full min-w-[50px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed${triggerClassName ? ` ${triggerClassName}` : ""}`}
                >
                    {displayText}
                </button>

                {isOpen && !usePortal && (
                    <div
                        className={`absolute right-0 top-full mt-1 z-[100] overflow-hidden ${effectiveMonthOnly ? "datepicker-monthly" : ""} ${isApex ? "apex-perf-date-panel" : "bg-white border border-gray-200 rounded-lg shadow-lg"}`}
                    >
                        {dropdownInner}
                    </div>
                )}
            </div>
            {portalNode}
        </div>
    );
}
