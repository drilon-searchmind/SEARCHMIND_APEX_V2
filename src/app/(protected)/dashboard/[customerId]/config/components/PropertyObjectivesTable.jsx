import React, { useState, useEffect } from "react";

const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
];

export default function PropertyObjectivesTable({ objectives = {}, onObjectivesChange }) {
    const [localObjectives, setLocalObjectives] = useState({});

    useEffect(() => {
        setLocalObjectives(objectives || {});
    }, [objectives]);

    const handleInputChange = (month, field, value) => {
        setLocalObjectives(prev => {
            const updated = {
                ...prev,
                [month]: {
                    ...prev[month],
                    [field]: value === '' ? '' : Number(value)
                }
            };
            if (onObjectivesChange) onObjectivesChange(updated);
            return updated;
        });
    };

    return (
        <div className="overflow-x-auto">
            <div id="tableWrapper" className="border border-gray-200 rounded-[0.5rem] overflow-hidden">
                <form>
                    <table className="min-w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-4 py-2 font-semibold text-gray-700 text-left">Month</th>
                                <th className="px-4 py-2 font-semibold text-gray-700 text-left">Revenue Target</th>
                                <th className="px-4 py-2 font-semibold text-gray-700 text-left">Marketing Budget</th>
                            </tr>
                        </thead>
                        <tbody>
                            {months.map((month, idx) => {
                                const row = localObjectives[month] || {};
                                return (
                                    <tr key={month} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="px-4 py-2 capitalize font-medium text-gray-900">{month}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                                value={row.revenueTarget === undefined ? '' : row.revenueTarget}
                                                onChange={e => handleInputChange(month, 'revenueTarget', e.target.value)}
                                                placeholder="DKK"
                                                min="0"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                                                value={row.marketingBudget === undefined ? '' : row.marketingBudget}
                                                onChange={e => handleInputChange(month, 'marketingBudget', e.target.value)}
                                                placeholder="DKK"
                                                min="0"
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </form>
            </div>
        </div>
    );
}
