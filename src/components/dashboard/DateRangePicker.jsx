"use client";

import React, { useState, useRef, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import dayjs from "dayjs";

const DATE_FORMAT = "YYYY-MM-DD";

function toDate(str) {
    if (!str || typeof str !== "string") return null;
    const d = dayjs(str, DATE_FORMAT);
    return d.isValid() ? d.toDate() : null;
}

function toStr(date) {
    if (!date) return "";
    return dayjs(date).format(DATE_FORMAT);
}

const PRESETS = [
    { label: "Today", getRange: () => ({ start: dayjs(), end: dayjs() }) },
    { label: "Yesterday", getRange: () => ({ start: dayjs().subtract(1, "day"), end: dayjs().subtract(1, "day") }) },
    { label: "Last 7 days", getRange: () => ({ start: dayjs().subtract(6, "day"), end: dayjs() }) },
    { label: "Last 30 days", getRange: () => ({ start: dayjs().subtract(29, "day"), end: dayjs() }) },
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
            return { start: lastMonth.startOf("month"), end: lastMonth.endOf("month") };
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
    { label: "Last month", getRange: () => ({ start: dayjs().subtract(1, "month").startOf("month"), end: dayjs().subtract(1, "month").endOf("month") }) },
    { label: "2 months ago", getRange: () => ({ start: dayjs().subtract(2, "month").startOf("month"), end: dayjs().subtract(2, "month").endOf("month") }) },
    { label: "3 months ago", getRange: () => ({ start: dayjs().subtract(3, "month").startOf("month"), end: dayjs().subtract(3, "month").endOf("month") }) },
];

export default function DateRangePicker({
    onApply,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    loading,
    showComparisonMethodToggler = false,
    comparisonMethod = "Last Year",
    onComparisonMethodChange,
    monthOnly = false,
    /** When set (non-empty), replaces default day-range presets. Ignored when monthOnly. */
    customPresets = null,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);

    const startDateObj = toDate(startDate);
    const endDateObj = toDate(endDate);

    useEffect(() => {
        function handleClickOutside(e) {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    const handleChange = (dates) => {
        const [start, end] = dates;
        if (onStartDateChange) onStartDateChange(toStr(start));
        if (onEndDateChange) onEndDateChange(toStr(end));
    };

    const handleMonthChange = (date) => {
        if (!date) return;
        const d = dayjs(date);
        const today = dayjs();
        const start = d.startOf("month").format(DATE_FORMAT);
        const end =
            d.isSame(today, "month")
                ? (today.date() === 1 ? today : today.subtract(1, "day")).format(DATE_FORMAT)
                : d.endOf("month").format(DATE_FORMAT);
        if (onStartDateChange) onStartDateChange(start);
        if (onEndDateChange) onEndDateChange(end);
    };

    const handlePreset = (preset) => {
        const { start, end } = preset.getRange();
        if (onStartDateChange) onStartDateChange(start.format(DATE_FORMAT));
        if (onEndDateChange) onEndDateChange(end.format(DATE_FORMAT));
    };

    const handleApply = () => {
        if (loading) return;
        setIsOpen(false);
        if (onApply) onApply({ startDate, endDate, comparisonMethod: showComparisonMethodToggler ? comparisonMethod : undefined });
    };

    const displayText = startDate && endDate ? `${startDate} to ${endDate}` : "Select date range";

    const presetList =
        monthOnly ? MONTH_PRESETS : customPresets?.length ? customPresets : PRESETS;

    return (
        <div className="flex items-center gap-2 flex-wrap" ref={popoverRef}>
            <div className="relative">
                <button
                    id="date-range-picker-button"
                    type="button"
                    onClick={() => !loading && setIsOpen((o) => !o)}
                    disabled={loading}
                    className="text-nowrap text-center border border-gray-200 rounded-lg px-3 py-2 text-xs w-full min-w-[50px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {displayText}
                </button>

                {isOpen && (
                    <div className={`absolute right-0 top-full mt-1 z-[100] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden ${monthOnly ? "datepicker-monthly" : ""}`}>
                        <span className="flex flex-row gap-2">
                            <div className="p-3 w-full">
                                <div className="text-xs font-medium text-gray-500 mb-2">Presets</div>
                                <div className="flex flex-wrap gap-1">
                                    {presetList.map((preset) => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => handlePreset(preset)}
                                            disabled={loading}
                                            className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 w-full text-nowrap text-left"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                {showComparisonMethodToggler && (
                                    <div className="mt-3 pt-3">
                                        <div className="text-xs font-medium text-gray-500 mb-2">Comparison</div>
                                        <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden">
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => onComparisonMethodChange?.("Last Year")}
                                                className={`text-nowrap flex-1 px-2 py-1 text-xs font-medium focus:outline-none transition-colors duration-150 ${comparisonMethod === "Last Year" ? "bg-white text-[var(--color-primary-searchmind)] shadow-sm" : "text-gray-500 hover:text-[var(--color-primary-searchmind)]"}`}
                                                style={{ borderRadius: "6px 0 0 6px" }}
                                            >
                                                Last Year
                                            </button>
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => onComparisonMethodChange?.("Last Period")}
                                                className={`text-nowrap flex-1 px-2 py-1 text-xs font-medium focus:outline-none transition-colors duration-150 ${comparisonMethod === "Last Period" ? "bg-white text-[var(--color-primary-searchmind)] shadow-sm" : "text-gray-500 hover:text-[var(--color-primary-searchmind)]"}`}
                                                style={{ borderRadius: "0 6px 6px 0" }}
                                            >
                                                Last Period
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <span className="relative">
                                <div className="flex flex-col justify-between h-auto p-2">
                                    <div className="text-xs font-medium text-gray-500 mb-2">
                                        {monthOnly ? "Month" : "Date Range"}
                                    </div>
                                    {monthOnly ? (
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
                                            onChange={handleChange}
                                            selectsRange
                                            inline
                                            dateFormat={DATE_FORMAT}
                                            disabled={loading}
                                        />
                                    )}
                                </div>
                                <div className="flex justify-end px-2">
                                    <button
                                        type="button"
                                        onClick={handleApply}
                                        disabled={loading}
                                        className="mt-3 h-auto text-xs px-4 py-2 rounded-lg text-white bg-[var(--color-primary-searchmind)] hover:bg-[var(--color-primary-searchmind-lighter)] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </span>
                        </span>
                    </div>
                )}
            </div>
            {/* <span onClick={handleApply} style={{ cursor: loading ? "not-allowed" : "pointer" }}>
                <FormButton buttonSize="small" disabled={loading}>
                    Apply
                </FormButton>
            </span> */}
        </div>
    );
}
