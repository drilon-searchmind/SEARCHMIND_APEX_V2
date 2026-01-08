import React, { useState, useMemo } from "react";
import { CAMPAIGN_STATUSES } from "../static-data/statuses";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function CampaignsKanban({ customerId, campaigns = [], onStatusChange }) {
    // Default date range: first of month to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const defaultEnd = `${yyyy}-${mm}-${dd}`;
    const defaultStart = `${yyyy}-${mm}-01`;
    const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [search, setSearch] = useState("");

    // Filter campaigns by customer, date range, and search
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter((c) => {
            if (search && !String(c.campaignName || "").toLowerCase().includes(search.toLowerCase())) return false;
            // Only show campaigns that overlap with selected date range
            const campaignStart = c.startDate ? new Date(c.startDate) : null;
            const campaignEnd = c.endDate ? new Date(c.endDate) : null;
            const rangeStart = new Date(dateRange.startDate);
            const rangeEnd = new Date(dateRange.endDate);
            return (
                (!campaignStart || campaignEnd >= rangeStart) &&
                (!campaignEnd || campaignStart <= rangeEnd)
            );
        });
    }, [campaigns, dateRange, search]);

    // Group campaigns by status
    const campaignsByStatus = useMemo(() => {
        const map = {};
        CAMPAIGN_STATUSES.forEach((status) => { map[status] = []; });
        filteredCampaigns.forEach((c) => {
            // Only group campaigns with valid status
            if (CAMPAIGN_STATUSES.includes(c.status)) {
                map[c.status].push(c);
            }
        });
        return map;
    }, [filteredCampaigns]);

    // Drag and drop handlers
    function onDragEnd(result) {
        const { source, destination, draggableId } = result;
        if (!destination || source.droppableId === destination.droppableId) return;
        const campaign = campaigns.find((c) => c.id === draggableId);
        if (campaign && onStatusChange) {
            onStatusChange(draggableId, destination.droppableId);
        }
    }

    return (
        <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-4 items-center">
                <DateRangePicker
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    onStartDateChange={(d) => setDateRange((r) => ({ ...r, startDate: d }))}
                    onEndDateChange={(d) => setDateRange((r) => ({ ...r, endDate: d }))}
                />
                <input
                    type="text"
                    placeholder="Search campaign name..."
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {CAMPAIGN_STATUSES.map((status) => (
                        <Droppable droppableId={status} key={status}>
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="bg-white border border-gray-200 rounded-xl p-4 min-h-[300px] flex flex-col gap-2 shadow-sm"
                                >
                                    <div className="font-bold text-lg text-gray-900 mb-2">{status}</div>
                                    {campaignsByStatus[status].length === 0 && (
                                        <div className="text-gray-400 py-8 text-center">No campaigns</div>
                                    )}
                                    {campaignsByStatus[status].map((c, idx) => (
                                        <Draggable draggableId={c.id} index={idx} key={c.id}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={`bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2 flex flex-col gap-1 shadow-sm transition-shadow duration-150 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.media}</span>
                                                        <span className="text-xs text-gray-500">{c.campaignFormat}</span>
                                                    </div>
                                                    <div className="font-bold text-base text-gray-900">{c.campaignName}</div>
                                                    <div className="text-xs text-gray-500">{c.messageBrief}</div>
                                                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                                                        <span>{c.countryCode}</span>
                                                        <span>{c.b2bOrB2c}</span>
                                                        <span>Budget: {typeof c.budget === 'number' ? c.budget.toLocaleString() + ' DKK' : '-'} </span>
                                                        {c.readyForApproval && <span className="text-green-500 font-semibold">Ready for Approval</span>}
                                                    </div>
                                                    <div className="flex justify-between items-end mt-2">
                                                        <span className="text-xs text-gray-300">Created: {c.createdAt}</span>
                                                        <button className="text-xs text-[var(--color-primary-searchmind)] font-semibold hover:underline">View details</button>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}
