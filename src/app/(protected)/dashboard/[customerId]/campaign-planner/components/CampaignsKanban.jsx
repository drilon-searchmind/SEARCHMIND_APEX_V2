import React, { useState, useMemo, useEffect } from "react";
import { CAMPAIGN_STATUSES } from "../static-data/statuses";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const SERVICE_COLORS = {
    "Paid Social": "#dbeafe", // light blue
    "Paid Search": "#dcfce7", // light green
    "Email Marketing": "#e9d5ff", // light purple
    "SEO": "#fed7aa", // light orange
};

// Mapping ClickUp service IDs to campaign service names
const CLICKUP_TO_CAMPAIGN_SERVICES = {
    "51ed563e-4a2c-489b-9506-be385c49a354": "SEO", // SEO
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "Paid Search", // PPC
    "2df85265-d5eb-4e86-a111-5d55623851fa": "Paid Social", // PS
    "55b3e92d-5972-4246-8160-73d7ba04401a": "Email Marketing", // EM
};

const SERVICES = ["Paid Social", "Paid Search", "Email Marketing", "SEO"];
const MEDIA = ["META", "LinkedIn", "Pinterest", "TikTok", "YouTube", "Google", "Email", "Website", "Other"];
const FORMATS = ["Video", "Picture", "Carousel", "Display Ad", "Search Ad", "Newsletter", "Email Flow", "Landingpage", "Collection"];

export default function CampaignsKanban({
    customerId,
    campaigns = [],
    onStatusChange,
    onViewDetails,
    showChildCampaigns = true,
    showDwarfCampaigns = true,
    dateRange,
    setDateRange,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    serviceFilter,
    setServiceFilter,
    parentFilter,
    setParentFilter,
    availableStatuses,
    availableServices,
    parentCampaigns,
    filterCampaigns
}) {
    const [clickupUsers, setClickupUsers] = useState([]);
    const [viewMode, setViewMode] = useState("full"); // "full" or "compact"

    // Helper function to get users for a campaign
    const getCampaignUsers = (campaign) => {
        if (campaign.assignedUsers && campaign.assignedUsers.length > 0) {
            return campaign.assignedUsers;
        }
        // Fallback: find users based on service
        return clickupUsers
            .filter(user => {
                const campaignService = CLICKUP_TO_CAMPAIGN_SERVICES[user.service];
                return campaignService === campaign.service;
            })
            .map(user => user.id);
    };

    useEffect(() => {
        const fetchClickupUsers = async () => {
            if (!customerId) return;
            try {
                const response = await fetch(`/api/clickup-team-members/${customerId}`);
                if (response.ok) {
                    const data = await response.json();
                    setClickupUsers(data.members || []);
                }
            } catch (error) {
                console.error('Error fetching ClickUp users:', error);
            }
        };

        fetchClickupUsers();
    }, [customerId]);

    // Filter campaigns using shared filter function and toggle filters
    const filteredCampaigns = useMemo(() => {
        let filtered = filterCampaigns(campaigns);

        // Exclude parent campaigns from kanban board (they don't have statuses)
        filtered = filtered.filter(c =>
            c.campaignLevel === "child" ||
            c.campaignLevel === "dwarf" ||
            (!c.campaignLevel && c.parentCampaignId) // Legacy child campaigns
        );

        // Apply toggle filters
        if (!showChildCampaigns) {
            filtered = filtered.filter(c => c.campaignLevel !== "child");
        }

        if (!showDwarfCampaigns) {
            filtered = filtered.filter(c => c.campaignLevel !== "dwarf");
        }

        return filtered;
    }, [filterCampaigns, campaigns, showChildCampaigns, showDwarfCampaigns]);

    // Separate ended campaigns from active campaigns
    const { activeCampaigns, endedCampaigns } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        const active = [];
        const ended = [];

        filteredCampaigns.forEach((c) => {
            // Check if campaign has ended (endDate is before today)
            const endDate = c.endDate ? new Date(c.endDate) : null;
            const hasEnded = endDate && endDate < today;

            if (hasEnded && c.status !== "Ended") {
                // Mark as ended if end date has passed and status isn't already "Ended"
                ended.push({ ...c, status: "Ended" });
            } else if (c.status === "Ended") {
                // Include campaigns that are already marked as Ended
                ended.push(c);
            } else if (CAMPAIGN_STATUSES.includes(c.status)) {
                // Include active campaigns with valid statuses
                active.push(c);
            }
        });

        return { activeCampaigns: active, endedCampaigns: ended };
    }, [filteredCampaigns]);

    // Group active campaigns by status (excluding Ended)
    const campaignsByStatus = useMemo(() => {
        const map = {};
        const activeStatuses = CAMPAIGN_STATUSES.filter(status => status !== "Ended");
        activeStatuses.forEach((status) => { map[status] = []; });

        activeCampaigns.forEach((c) => {
            if (activeStatuses.includes(c.status)) {
                map[c.status].push(c);
            }
        });

        return map;
    }, [activeCampaigns]);

    // Drag and drop handlers
    function onDragEnd(result) {
        const { source, destination, draggableId } = result;
        if (!destination || source.droppableId === destination.droppableId) return;

        // Prevent dragging to "Ended" status - it should only be set automatically
        if (destination.droppableId === "Ended") return;

        // Find campaign by _id or id
        const campaign = campaigns.find((c) => String(c._id) === draggableId || String(c.id) === draggableId);
        if (campaign && onStatusChange) {
            // Always pass _id if available
            onStatusChange(campaign._id ? campaign._id : campaign.id, destination.droppableId);
        }
    }

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl p-6">
            {/* View Mode Toggle */}
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Child Campaigns Overview</h3>
            <div className="flex items-center justify-end mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">View:</span>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('full')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'full'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Full
                        </button>
                        <button
                            onClick={() => setViewMode('compact')}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'compact'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Compact
                        </button>
                    </div>
                </div>
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mt-10">
                    {/* Active status columns (draggable) */}
                    {CAMPAIGN_STATUSES.filter(status => status !== "Ended").map((status) => (
                        <Droppable droppableId={status} key={status}>
                            {(provided) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="bg-white border border-gray-200 rounded-lg p-4 min-h-[200px] flex flex-col gap-1"
                                >
                                    <div className="font-medium text-gray-900 mb-2">{status}</div>
                                    {campaignsByStatus[status].length === 0 && (
                                        <div className="text-gray-400 py-8 text-center">No campaigns</div>
                                    )}
                                    {campaignsByStatus[status].map((c, idx) => {
                                        // Ensure draggableId and key are always unique strings
                                        const draggableId = c._id ? String(c._id) : (c.id ? String(c.id) : `campaign-${status}-${idx}`);
                                        const key = c._id ? String(c._id) : (c.id ? String(c.id) : `campaign-${status}-${idx}`);
                                        return (
                                            <Draggable draggableId={draggableId} index={idx} key={key}>
                                                {(provided, snapshot) => (
                                                    viewMode === 'compact' ? (
                                                        // Compact View
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`border border-gray-200 rounded-lg p-2 mb-1 flex items-center gap-2 shadow-xs transition-all transition-shadow duration-150 cursor-pointer hover:bg-gray-100 ${snapshot.isDragging ? 'shadow-lg rotate-5' : ''}`}
                                                            onClick={() => onViewDetails && onViewDetails(c)}
                                                        >
                                                            <div 
                                                                style={{ backgroundColor: SERVICE_COLORS[c.service] || '#6b7280' }}
                                                                className="flex-1 min-w-0 rounded-lg p-2">
                                                                <div className="font-semibold text-sm text-gray-900 truncate">{c.campaignName}</div>
                                                                <div className="flex items-center gap-2 text-xs text-gray-700">
                                                                    <div className="flex items-center gap-1">
                                                                        <span>{c.service}</span>
                                                                    </div>
                                                                    {c.budget && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span>{c.budget.toLocaleString()} DKK</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {c.service && (() => {
                                                                const campaignUsers = getCampaignUsers(c);
                                                                return campaignUsers.length > 0 ? (
                                                                    <div className="flex items-center gap-1">
                                                                        {campaignUsers
                                                                            .slice(0, 2)
                                                                            .map((userId, idx) => {
                                                                                const user = clickupUsers.find(u => u.id === userId);
                                                                                return (
                                                                                    <div
                                                                                        key={userId}
                                                                                        className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0"
                                                                                        title={user?.username || `User ${userId.slice(-4)}`}
                                                                                    >
                                                                                        {user?.avatar ? (
                                                                                            <img
                                                                                                src={user.avatar}
                                                                                                alt={user.username}
                                                                                                className="w-4 h-4 rounded-full object-cover"
                                                                                            />
                                                                                        ) : (
                                                                                            <span className="text-xs font-medium text-white">
                                                                                                {user?.username?.charAt(0).toUpperCase() || '?'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        {campaignUsers.length > 2 && (
                                                                                <div className="w-4 h-4 rounded-full bg-[var(--color-primary-searchmind-lighter)] flex items-center justify-center flex-shrink-0">
                                                                                    <span className="text-xs font-light text-gray-50">
                                                                                        +{campaignUsers.length - 2}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        // Full View (default)
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`cursor-pointer bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2 flex flex-col gap-1 shadow-xs transition-all transition-shadow duration-150 ${snapshot.isDragging ? 'shadow-lg rotate-5' : ''}`}
                                                        >
                                                            <div 
                                                            
                                                                style={{ backgroundColor: SERVICE_COLORS[c.service] || '#000' }}
                                                                className="flex items-center justify-between rounded-lg p-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{c.service}</span>
                                                                </div>
                                                            </div>
                                                            <div className="font-bold text-base text-gray-900">{c.campaignName}</div>
                                                            <div className="flex flex-wrap gap-2 text-xs text-gray-800">
                                                                <span>Budget: {typeof c.budget === 'number' ? c.budget.toLocaleString() + ' DKK' : '-'} </span>
                                                            </div>
                                                            {c.service && (() => {
                                                                const campaignUsers = getCampaignUsers(c);
                                                                return campaignUsers.length > 0 ? (
                                                                    <div className="flex items-center gap-1 mt-1 relative">
                                                                        {campaignUsers
                                                                            .slice(0, 3)
                                                                            .map((userId, idx) => {
                                                                                const user = clickupUsers.find(u => u.id === userId);
                                                                                return (
                                                                                    <div
                                                                                        key={userId}
                                                                                        className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-2"
                                                                                        title={user?.username || `User ${userId.slice(-4)}`}
                                                                                        style={{
                                                                                            transform: `translateX(-${idx * 10}px)`,
                                                                                        }}
                                                                                    >
                                                                                        {user?.avatar ? (
                                                                                            <img
                                                                                                src={user.avatar}
                                                                                                alt={user.username}
                                                                                                className="w-6 h-6 rounded-full object-cover"
                                                                                            />
                                                                                        ) : (
                                                                                            <span className="text-xs font-medium text-white">
                                                                                                {user?.username?.charAt(0).toUpperCase() || '?'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        {campaignUsers.length > 3 && (
                                                                                <div
                                                                                    style={{
                                                                                        transform: `translateX(-${3 * 10}px)`,
                                                                                    }}
                                                                                    className="w-5 h-5 rounded-full bg-[var(--color-primary-searchmind-lighter)] flex items-center justify-center flex-shrink-0 mt-2">
                                                                                    <span
                                                                                        className="text-[0.65rem] font-light text-gray-50"
                                                                                    >
                                                                                        +{campaignUsers.length - 3}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                            <div className="flex justify-between items-end mt-2">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-gray-700">
                                                                        {c.startDate ? new Date(c.startDate).toLocaleDateString('da-DK') : '-'}</span>
                                                                    <span className="text-xs text-gray-700">-</span>
                                                                    <span className="text-xs text-gray-700">{c.endDate ? new Date(c.endDate).toLocaleDateString('da-DK') : '-'}</span>
                                                                </div>
                                                                <button
                                                                    className="text-xs bg-[var(--color-primary-searchmind)] font-semibold hover:underline text-white px-2 py-1 rounded"
                                                                    onClick={() => onViewDetails && onViewDetails(c)}
                                                                >
                                                                    View details
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </Draggable>
                                        );
                                    })}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    ))}

                    {/* Ended campaigns section (non-draggable) */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[200px] flex flex-col gap-1">
                        <div className="font-medium text-gray-900 mb-2">Ended</div>
                        {endedCampaigns.length === 0 ? (
                            <div className="text-gray-400 py-8 text-center">No ended campaigns</div>
                        ) : (
                            endedCampaigns.map((c, idx) => {
                                const key = c._id ? String(c._id) : (c.id ? String(c.id) : `ended-campaign-${idx}`);
                                return (
                                    <div
                                        key={key}
                                        className="border border-gray-200 rounded-lg p-2 mb-1 flex items-center gap-2 shadow-xs cursor-pointer hover:bg-gray-100 bg-white"
                                        onClick={() => onViewDetails && onViewDetails(c)}
                                    >
                                        <div
                                            style={{ backgroundColor: SERVICE_COLORS[c.service] || '#6b7280' }}
                                            className="flex-1 min-w-0 rounded-lg p-2 opacity-75"
                                        >
                                            <div className="font-semibold text-sm text-gray-900 truncate">{c.campaignName}</div>
                                            <div className="flex items-center gap-2 text-xs text-gray-700">
                                                <div className="flex items-center gap-1">
                                                    <span>{c.service}</span>
                                                </div>
                                                {c.budget && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{c.budget.toLocaleString()} DKK</span>
                                                    </>
                                                )}
                                            </div>
                                            {c.service && (() => {
                                                const campaignUsers = getCampaignUsers(c);
                                                return campaignUsers.length > 0 ? (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {campaignUsers
                                                            .slice(0, 2)
                                                            .map((userId) => {
                                                                const user = clickupUsers.find(u => u.id === userId);
                                                                return (
                                                                    <div
                                                                        key={userId}
                                                                        className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0"
                                                                        title={user?.username || `User ${userId.slice(-4)}`}
                                                                    >
                                                                        {user?.avatar ? (
                                                                            <img
                                                                                src={user.avatar}
                                                                                alt={user.username}
                                                                                className="w-4 h-4 rounded-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-xs font-medium text-white">
                                                                                {user?.username?.charAt(0).toUpperCase() || '?'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        {campaignUsers.length > 2 && (
                                                            <div className="w-4 h-4 rounded-full bg-[var(--color-primary-searchmind-lighter)] flex items-center justify-center flex-shrink-0">
                                                                <span className="text-xs font-light text-gray-50">
                                                                    +{campaignUsers.length - 2}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </DragDropContext>
        </div>
    );
}
