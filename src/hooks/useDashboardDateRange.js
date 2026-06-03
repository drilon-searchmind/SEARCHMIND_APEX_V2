"use client";

import { useState, useCallback, useMemo } from "react";
import {
    getDefaultDashboardDateRange,
    COMPARISON_METHOD,
    getComparisonMethodLabel,
} from "@/lib/dateRangeComparison";

/**
 * Shared date range + comparison state for dashboard DateRangePicker (modern two-column UI).
 */
export function useDashboardDateRange({ onApply: onApplyCallback } = {}) {
    const defaultRange = useMemo(() => getDefaultDashboardDateRange(), []);

    const [tempDateRange, setTempDateRange] = useState(defaultRange);
    const [appliedDateRange, setAppliedDateRange] = useState(defaultRange);
    const [tempCompareRange, setTempCompareRange] = useState({
        startDate: "",
        endDate: "",
    });
    const [appliedCompareRange, setAppliedCompareRange] = useState({
        startDate: "",
        endDate: "",
    });
    const [comparisonMethod, setComparisonMethod] = useState(
        COMPARISON_METHOD.LAST_YEAR
    );
    const [tempComparisonMethod, setTempComparisonMethod] = useState(
        COMPARISON_METHOD.LAST_YEAR
    );

    const handleDateRangeApply = useCallback(
        ({
            startDate,
            endDate,
            comparisonMethod: appliedComparison,
            compareStartDate,
            compareEndDate,
        }) => {
            setAppliedDateRange({ startDate, endDate });
            if (appliedComparison) setComparisonMethod(appliedComparison);
            if (compareStartDate && compareEndDate) {
                setAppliedCompareRange({
                    startDate: compareStartDate,
                    endDate: compareEndDate,
                });
            } else {
                setAppliedCompareRange({ startDate: "", endDate: "" });
            }
            onApplyCallback?.({
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
                compareStartDate,
                compareEndDate,
            });
        },
        [onApplyCallback]
    );

    const handleStartDateChange = useCallback((newStart) => {
        setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
    }, []);

    const handleEndDateChange = useCallback((newEnd) => {
        setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
    }, []);

    const handleCompareStartChange = useCallback((newStart) => {
        setTempCompareRange((r) => ({ ...r, startDate: newStart }));
    }, []);

    const handleCompareEndChange = useCallback((newEnd) => {
        setTempCompareRange((r) => ({ ...r, endDate: newEnd }));
    }, []);

    const comparisonLabel = getComparisonMethodLabel(comparisonMethod);
    const comparisonMethodForUi =
        comparisonMethod === COMPARISON_METHOD.NONE ? null : comparisonMethod;

    const dateRangePickerProps = useMemo(
        () => ({
            onApply: handleDateRangeApply,
            startDate: tempDateRange.startDate,
            endDate: tempDateRange.endDate,
            onStartDateChange: handleStartDateChange,
            onEndDateChange: handleEndDateChange,
            compareStartDate: tempCompareRange.startDate,
            compareEndDate: tempCompareRange.endDate,
            onCompareStartDateChange: handleCompareStartChange,
            onCompareEndDateChange: handleCompareEndChange,
            showComparisonMethodToggler: true,
            comparisonMethod: tempComparisonMethod,
            onComparisonMethodChange: setTempComparisonMethod,
        }),
        [
            handleDateRangeApply,
            tempDateRange.startDate,
            tempDateRange.endDate,
            handleStartDateChange,
            handleEndDateChange,
            tempCompareRange.startDate,
            tempCompareRange.endDate,
            handleCompareStartChange,
            handleCompareEndChange,
            tempComparisonMethod,
        ]
    );

    return {
        defaultRange,
        tempDateRange,
        setTempDateRange,
        appliedDateRange,
        setAppliedDateRange,
        tempCompareRange,
        appliedCompareRange,
        comparisonMethod,
        tempComparisonMethod,
        comparisonLabel,
        comparisonMethodForUi,
        dateRangePickerProps,
        handleDateRangeApply,
        handleStartDateChange,
        handleEndDateChange,
    };
}
