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
        <div className="apex-config-table-wrap">
            <form>
                <table className="apex-config-table apex-config-table--objectives">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Revenue Target</th>
                            <th>Marketing Budget</th>
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((month) => {
                            const row = localObjectives[month] || {};
                            return (
                                <tr key={month}>
                                    <td className="is-brand">{month}</td>
                                    <td>
                                        <input
                                            type="number"
                                            value={row.revenueTarget === undefined ? '' : row.revenueTarget}
                                            onChange={e => handleInputChange(month, 'revenueTarget', e.target.value)}
                                            placeholder="DKK"
                                            min="0"
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
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
    );
}
