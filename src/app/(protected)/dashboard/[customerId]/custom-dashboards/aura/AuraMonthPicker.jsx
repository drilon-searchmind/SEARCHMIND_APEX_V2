"use client";

import React from "react";
import { MONTH_NAMES } from "./auraSheetLogic";

/** Month and year dropdowns (month is 0 based). Years: this year and the two before. */
export default function AuraMonthPicker({ year, month, onChange }) {
    const thisYear = new Date().getFullYear();
    const years = [thisYear, thisYear - 1, thisYear - 2];
    return (
        <div className="aura-picker">
            <label className="aura-picker__field">
                <span className="sr-only">Month</span>
                <select value={month} onChange={(e) => onChange({ year, month: Number(e.target.value) })}>
                    {MONTH_NAMES.map((name, i) => (
                        <option key={name} value={i}>
                            {name}
                        </option>
                    ))}
                </select>
            </label>
            <label className="aura-picker__field">
                <span className="sr-only">Year</span>
                <select value={year} onChange={(e) => onChange({ year: Number(e.target.value), month })}>
                    {years.map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}
