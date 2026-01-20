import React, { useState, useMemo } from "react";

const STATUS_COLORS = {
    Pending: "#fde68a",
    "Pending Customer Approval": "#fed7aa",
    Approved: "#bfdbfe",
    Live: "#bbf7d0",
    Ended: "#e5e7eb",
};

const SERVICES = ["Paid Social", "Paid Search", "Email Marketing", "SEO"];
const MEDIA = ["META", "LinkedIn", "Pinterest", "TikTok", "YouTube", "Google", "Email", "Website", "Other"];
const FORMATS = ["Video", "Picture", "Carousel", "Display Ad", "Search Ad", "Newsletter", "Email Flow", "Landingpage", "Collection"];

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

export default function CampaignsGantt({ campaigns = [], onViewDetails }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [mediaFilter, setMediaFilter] = useState("");
    const [formatFilter, setFormatFilter] = useState("");
    const [viewMode, setViewMode] = useState("compact"); // "compact" or "full"

    // Filter campaigns
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(campaign => {
            // Search filter
            if (search && !String(campaign.campaignName || "").toLowerCase().includes(search.toLowerCase())) return false;

            // Status filter
            if (statusFilter && campaign.status !== statusFilter) return false;

            // Service filter
            if (serviceFilter && campaign.service !== serviceFilter) return false;

            // Media filter
            if (mediaFilter && campaign.media !== mediaFilter) return false;

            // Format filter
            if (formatFilter && campaign.campaignFormat !== formatFilter) return false;

            return true;
        });
    }, [campaigns, search, statusFilter, serviceFilter, mediaFilter, formatFilter]);

    // Get the month and year range for the chart (using filtered campaigns)
    const { year, month, endYear, endMonth } = getDateRange(filteredCampaigns);
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
        <div className="w-full">
            {/* Filter Bar */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search campaigns..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full px-4 py-2 pl-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                            />
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="min-w-[150px]">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                        >
                            <option value="">All Statuses</option>
                            {Object.keys(STATUS_COLORS).map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-[150px]">
                        <select
                            value={serviceFilter}
                            onChange={(e) => setServiceFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                        >
                            <option value="">All Services</option>
                            {SERVICES.map((service) => (
                                <option key={service} value={service}>
                                    {service}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-[150px]">
                        <select
                            value={mediaFilter}
                            onChange={(e) => setMediaFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                        >
                            <option value="">All Media</option>
                            {MEDIA.map((media) => (
                                <option key={media} value={media}>
                                    {media}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-[150px]">
                        <select
                            value={formatFilter}
                            onChange={(e) => setFormatFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                        >
                            <option value="">All Formats</option>
                            {FORMATS.map((format) => (
                                <option key={format} value={format}>
                                    {format}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm text-gray-600">View:</span>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('compact')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    viewMode === 'compact'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Compact
                            </button>
                            <button
                                onClick={() => setViewMode('full')}
                                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                    viewMode === 'full'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Full
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gantt Chart */}
            <div className="w-full bg-white border border-gray-200 rounded-xl p-6">
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Header: months with day grid */}
                        <div className="mb-6">
                            <div className="flex border-b-2 border-gray-300 mb-2">
                                <div className={`${viewMode === 'compact' ? 'w-64' : 'w-64'} flex-shrink-0 p-3`}>
                                    <h3 className="text-sm font-semibold text-gray-700">
                                        {viewMode === 'compact' ? 'Campaign Name' : 'Campaign Details'}
                                    </h3>
                                </div>
                                <div className="flex-1 flex">
                                    {months.map(({ year, month }) => (
                                        <div key={year+"-"+month} className="flex-1">
                                            <div className="text-sm font-semibold text-gray-700 py-2 px-3 text-center border-r border-gray-200 bg-gray-50">
                                                {new Date(year, month).toLocaleString('default', { month: 'short', year: 'numeric' })}
                                            </div>
                                            {/* Day numbers - only show in full view */}
                                            {viewMode === 'full' && (
                                                <div className="flex">
                                                    {Array.from({ length: getMonthDays(year, month) }, (_, i) => i + 1).map(day => (
                                                        <div key={day} className="flex-1 text-xs text-gray-400 py-1 px-1 text-center border-r border-gray-100">
                                                            {day}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Campaign rows */}
                        <div className={viewMode === 'compact' ? 'space-y-2' : 'space-y-4'}>
                            {filteredCampaigns.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No campaigns match your filters.
                                </div>
                            ) : (
                                filteredCampaigns.map((c) => (
                                    viewMode === 'compact' ? (
                                        // Compact View - Only campaign title
                                        <div key={c.id || c._id} className="flex items-center bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                                            <div className="w-64 flex-shrink-0 p-3 border-r border-gray-200">
                                                <div
                                                    className="text-sm font-semibold text-gray-900 hover:text-[var(--color-primary-searchmind)] cursor-pointer truncate"
                                                    onClick={() => onViewDetails && onViewDetails(c)}
                                                    title="Click to view details"
                                                >
                                                    {c.campaignName}
                                                </div>
                                            </div>
                                            <div className="flex-1 relative bg-gray-50 min-h-[40px]">
                                                <div className="relative h-full">
                                                    {/* Simplified grid for compact view */}
                                                    <div className="absolute inset-0 flex">
                                                        {months.map(({ year, month }) => (
                                                            <div key={year+"-"+month} className="flex-1 border-r border-gray-200"></div>
                                                        ))}
                                                    </div>

                                                    {/* Campaign bar */}
                                                    <div
                                                        className="absolute top-2 h-6 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                                        style={{
                                                            ...getBarStyle(c),
                                                            backgroundColor: STATUS_COLORS[c.status] || 'var(--color-primary-searchmind)',
                                                            minWidth: '8px'
                                                        }}
                                                        onClick={() => onViewDetails && onViewDetails(c)}
                                                        title={`${c.campaignName}: ${c.startDate ? new Date(c.startDate).toLocaleDateString('da-DK') : 'No start'} - ${c.endDate ? new Date(c.endDate).toLocaleDateString('da-DK') : 'No end'}`}
                                                    />

                                                    {/* Today indicator */}
                                                    {(() => {
                                                        const today = new Date();
                                                        const chartStart = new Date(year, month, 1);
                                                        const chartEnd = new Date(months[months.length-1].year, months[months.length-1].month, getMonthDays(months[months.length-1].year, months[months.length-1].month));
                                                        const totalDays = (chartEnd - chartStart) / (1000*60*60*24) + 1;
                                                        const todayOffset = (today - chartStart) / (1000*60*60*24);

                                                        if (today >= chartStart && today <= chartEnd) {
                                                            return (
                                                                <div
                                                                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                                                                    style={{ left: `${(todayOffset/totalDays)*100}%` }}
                                                                />
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Full View - Complete details
                                        <div key={c.id || c._id} className="group">
                                            {/* Campaign Info Panel */}
                                            <div className="flex mb-2">
                                                <div className="w-64 flex-shrink-0 p-4 bg-gray-50 rounded-l-lg border border-gray-200">
                                                    <div className="space-y-2">
                                                        <div
                                                            className="text-sm font-semibold text-gray-900 hover:text-[var(--color-primary-searchmind)] cursor-pointer truncate"
                                                            onClick={() => onViewDetails && onViewDetails(c)}
                                                            title="Click to view details"
                                                        >
                                                            {c.campaignName}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="px-2 py-1 text-xs font-medium rounded-full"
                                                                style={{ backgroundColor: STATUS_COLORS[c.status] || '#e5e7eb', color: '#1E2B2B' }}
                                                            >
                                                                {c.status}
                                                            </span>
                                                            <span className="text-xs text-gray-500">{c.service}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-600">
                                                            <div>{c.media} • {c.campaignFormat}</div>
                                                            <div className="mt-1">
                                                                {c.startDate && c.endDate ? (
                                                                    <>
                                                                        {new Date(c.startDate).toLocaleDateString('da-DK')} - {new Date(c.endDate).toLocaleDateString('da-DK')}
                                                                    </>
                                                                ) : (
                                                                    'No dates set'
                                                                )}
                                                            </div>
                                                            {c.budget && (
                                                                <div className="font-medium text-[var(--color-primary-searchmind)]">
                                                                    {c.budget.toLocaleString('da-DK')} DKK
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Timeline Bar */}
                                                <div className="flex-1 relative bg-gray-50 rounded-r-lg border-r border-t border-b border-gray-200 min-h-[100px]">
                                                    <div className="relative h-full">
                                                        {/* Grid lines for days */}
                                                        <div className="absolute inset-0 flex">
                                                            {months.map(({ year, month }) => (
                                                                <div key={year+"-"+month} className="flex-1 flex border-r border-gray-100">
                                                                    {Array.from({ length: getMonthDays(year, month) }, (_, i) => i + 1).map(day => (
                                                                        <div key={day} className="flex-1 border-r border-gray-50"></div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Campaign bar */}
                                                        <div
                                                            className="absolute top-4 h-8 rounded-lg shadow-sm border-2 border-white cursor-pointer hover:shadow-md transition-shadow"
                                                            style={{
                                                                ...getBarStyle(c),
                                                                backgroundColor: STATUS_COLORS[c.status] || 'var(--color-primary-searchmind)',
                                                                minWidth: '12px'
                                                            }}
                                                            onClick={() => onViewDetails && onViewDetails(c)}
                                                            title={`${c.campaignName}: ${c.startDate ? new Date(c.startDate).toLocaleDateString('da-DK') : 'No start'} - ${c.endDate ? new Date(c.endDate).toLocaleDateString('da-DK') : 'No end'}`}
                                                        >
                                                            <div className="flex items-center justify-center h-full px-2">
                                                                <span className="text-xs font-medium text-gray-800 truncate">
                                                                    {c.campaignName}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Today indicator */}
                                                        {(() => {
                                                            const today = new Date();
                                                            const chartStart = new Date(year, month, 1);
                                                            const chartEnd = new Date(months[months.length-1].year, months[months.length-1].month, getMonthDays(months[months.length-1].year, months[months.length-1].month));
                                                            const totalDays = (chartEnd - chartStart) / (1000*60*60*24) + 1;
                                                            const todayOffset = (today - chartStart) / (1000*60*60*24);

                                                            if (today >= chartStart && today <= chartEnd) {
                                                                return (
                                                                    <div
                                                                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                                                                        style={{ left: `${(todayOffset/totalDays)*100}%` }}
                                                                        title={`Today: ${today.toLocaleDateString('da-DK')}`}
                                                                    >
                                                                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
