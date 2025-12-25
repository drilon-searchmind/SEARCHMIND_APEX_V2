import React, { useState } from "react";
import FormButton from "../form/FormButton";

export default function DateRangePicker({ onApply }) {
    // Default: start = first of current month, end = today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(defaultEnd);

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
