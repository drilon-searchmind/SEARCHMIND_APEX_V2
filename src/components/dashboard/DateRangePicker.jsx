import React, { useState } from "react";
import FormButton from "../form/FormButton";

export default function DateRangePicker({ onApply }) {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const handleApply = () => {
        if (onApply) onApply({ startDate, endDate });
    };

    return (
        <div className="flex items-center gap-2">
            <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
            />
            <FormButton buttonSize="small" onClick={handleApply}>
                Apply
            </FormButton>
                
        </div>
    );
}
