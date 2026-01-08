import React from "react";

function getMonthDays(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getDateRange(campaigns) {
    let min = null, max = null;
    campaigns.forEach(c => {
        const start = c.startDate ? new Date(c.startDate) : null;
        const end = c.endDate ? new Date(c.endDate) : null;
        if (start && (!min || start < min)) min = start;
        if (end && (!max || end > max)) max = end;
    });
    if (!min || !max) {
        const today = new Date();
        return { year: today.getFullYear(), month: today.getMonth() };
    }
    return { year: min.getFullYear(), month: min.getMonth(), endYear: max.getFullYear(), endMonth: max.getMonth() };
}

export default function CampaignsGantt({ campaigns = [] }) {
    // Get the month and year range for the chart
    const { year, month, endYear, endMonth } = getDateRange(campaigns);
    const months = [];
    let y = year, m = month;
    while (y < (endYear || year) || (y === (endYear || year) && m <= (endMonth || month))) {
        months.push({ year: y, month: m });
        m++;
        if (m > 11) { m = 0; y++; }
    }

    // Helper to get left offset and width for a campaign bar
    function getBarStyle(c) {
        const start = c.startDate ? new Date(c.startDate) : null;
        const end = c.endDate ? new Date(c.endDate) : null;
        if (!start || !end) return { left: 0, width: 0 };
        // Calculate days from chart start
        const chartStart = new Date(year, month, 1);
        const chartEnd = new Date(months[months.length-1].year, months[months.length-1].month, getMonthDays(months[months.length-1].year, months[months.length-1].month));
        const totalDays = (chartEnd - chartStart) / (1000*60*60*24) + 1;
        const startOffset = (start - chartStart) / (1000*60*60*24);
        const endOffset = (end - chartStart) / (1000*60*60*24);
        const left = `${(startOffset/totalDays)*100}%`;
        const width = `${((endOffset-startOffset+1)/totalDays)*100}%`;
        return { left, width };
    }

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-4">
            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Header: months */}
                    <div className="flex border-b border-gray-200 mb-2">
                        {months.map(({ year, month }) => (
                            <div key={year+"-"+month} className="flex-1 text-xs text-gray-500 py-2 px-2 text-center font-semibold">
                                {new Date(year, month).toLocaleString('default', { month: 'short', year: 'numeric' })}
                            </div>
                        ))}
                    </div>
                    {/* Campaign rows */}
                    <div className="space-y-2">
                        {campaigns.map((c) => (
                            <div key={c.id} className="flex items-center h-10 relative">
                                <div className="w-32 text-xs text-gray-700 font-medium truncate pr-2">{c.campaignName}</div>
                                <div className="flex-1 relative h-6">
                                    <div
                                        className="absolute h-6 rounded bg-[var(--color-primary-searchmind)] opacity-80"
                                        style={{ ...getBarStyle(c), minWidth: '8px' }}
                                        title={`${c.campaignName}: ${c.startDate} - ${c.endDate}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
