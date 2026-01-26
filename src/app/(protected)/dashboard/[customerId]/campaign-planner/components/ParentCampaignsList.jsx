import React, { useState } from "react";
import { FiChevronDown, FiChevronRight, FiPlus } from "react-icons/fi";

const STATUS_COLORS = {
    "Pending": "bg-yellow-100 text-yellow-800",
    "Pending Customer Approval": "bg-orange-100 text-orange-800",
    "Approved": "bg-blue-100 text-blue-800",
    "Live": "bg-green-100 text-green-800",
    "Ended": "bg-gray-100 text-gray-800",
};

export default function ParentCampaignsList({ 
    campaigns, 
    onViewDetails, 
    onCreateChild,
    customerId 
}) {
    const [expandedParents, setExpandedParents] = useState({});

    // Separate campaigns by level
    const parentCampaigns = campaigns.filter(c => c.campaignLevel === "parent" || (!c.campaignLevel && !c.parentCampaignId));
    const childCampaigns = campaigns.filter(c => c.campaignLevel === "child" || (!c.campaignLevel && c.parentCampaignId));
    const dwarfCampaigns = campaigns.filter(c => c.campaignLevel === "dwarf");

    // Group children and dwarfs by parent
    const getChildrenForParent = (parentId) => {
        return childCampaigns.filter(c => c.parentCampaignId === parentId);
    };

    const getDwarfsForChild = (childId) => {
        return dwarfCampaigns.filter(d => d.parentCampaignId === childId);
    };

    const toggleParent = (parentId) => {
        setExpandedParents(prev => ({
            ...prev,
            [parentId]: !prev[parentId]
        }));
    };

    // Check if child campaign is missing required fields
    const getMissingFields = (campaign) => {
        const missing = [];
        if (!campaign.service) missing.push("Service");
        if (!campaign.media) missing.push("Media");
        if (!campaign.campaignFormat) missing.push("Campaign Format");
        if (!campaign.countryCode) missing.push("Country Code");
        if (!campaign.startDate) missing.push("Start Date");
        if (!campaign.endDate && !campaign.alwaysOn) missing.push("End Date");
        if (!campaign.budget) missing.push("Budget");
        return missing;
    };

    const formatDate = (date) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleDateString('da-DK');
    };

    const formatCurrency = (amount) => {
        if (!amount) return "N/A";
        return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(amount);
    };

    return (
        <div className="w-full">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">Parent Campaigns</h3>
                </div>
                <div className="divide-y divide-gray-200">
                    {parentCampaigns.length === 0 ? (
                        <div className="px-6 py-8 text-center text-gray-500">
                            No parent campaigns found. Create one to get started.
                        </div>
                    ) : (
                        parentCampaigns.map((parent) => {
                            const isExpanded = expandedParents[parent._id];
                            const children = getChildrenForParent(parent._id);
                            
                            return (
                                <div key={parent._id} className="hover:bg-gray-50 transition-colors">
                                    {/* Parent Campaign Row */}
                                    <div 
                                        className="px-6 py-4 flex items-center justify-between cursor-pointer"
                                        onClick={() => toggleParent(parent._id)}
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            {isExpanded ? (
                                                <FiChevronDown className="text-gray-400" />
                                            ) : (
                                                <FiChevronRight className="text-gray-400" />
                                            )}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-gray-900">{parent.campaignName}</h4>
                                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                        {parent.responsible || "searchmind"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                                    <span>Services: {parent.services?.join(", ") || "N/A"}</span>
                                                    <span>Budget: {formatCurrency(parent.totalBudget)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewDetails(parent);
                                                }}
                                                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const parentId = parent._id || parent.id;
                                                    console.log("Add Child clicked, parent ID:", parentId, "parent:", parent);
                                                    onCreateChild({ 
                                                        parentCampaignId: parentId, 
                                                        isDwarf: false 
                                                    });
                                                }}
                                                className="px-3 py-1 text-sm bg-[var(--color-primary-searchmind)] text-white hover:bg-[var(--color-primary-searchmind-lighter)] rounded flex items-center gap-1"
                                            >
                                                <FiPlus size={14} />
                                                Add Child
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Children */}
                                    {isExpanded && (
                                        <div className="bg-gray-50 border-t border-gray-200">
                                            {children.length === 0 ? (
                                                <div className="px-12 py-4 text-sm text-gray-500">
                                                    No child campaigns yet. Click "Add Child" to create one.
                                                </div>
                                            ) : (
                                                children.map((child) => {
                                                    const dwarfs = getDwarfsForChild(child._id);
                                                    const missingFields = getMissingFields(child);
                                                    
                                                    return (
                                                        <div key={child._id} className="px-12 py-3 border-b border-gray-200 last:border-b-0">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <h5 className="font-medium text-gray-900">{child.campaignName}</h5>
                                                                        {missingFields.length > 0 && (
                                                                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                                                Missing: {missingFields.join(", ")}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                                                        <span>Service: {child.service || "N/A"}</span>
                                                                        <span>Media: {child.media || "N/A"}</span>
                                                                        <span>Budget: {formatCurrency(child.budget)}</span>
                                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[child.status] || STATUS_COLORS["Pending"]}`}>
                                                                            {child.status}
                                                                        </span>
                                                                    </div>
                                                                    {dwarfs.length > 0 && (
                                                                        <div className="mt-2 ml-4">
                                                                            <p className="text-xs text-gray-500 mb-1">Dwarf Campaigns ({dwarfs.length}):</p>
                                                                            {dwarfs.map((dwarf) => (
                                                                                <div key={dwarf._id} className="text-xs text-gray-600 ml-2">
                                                                                    • {dwarf.campaignName} ({dwarf.status})
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => onViewDetails(child)}
                                                                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                                                    >
                                                                        View
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            // Create dwarf campaign - parent is the child campaign (child._id)
                                                                            const childId = child._id || child.id;
                                                                            console.log("Add Dwarf clicked, child ID:", childId, "child:", child);
                                                                            onCreateChild({ 
                                                                                parentCampaignId: childId, 
                                                                                isDwarf: true 
                                                                            });
                                                                        }}
                                                                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 rounded flex items-center gap-1"
                                                                    >
                                                                        <FiPlus size={12} />
                                                                        Add Dwarf
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modals are handled by parent component (page.jsx) */}
        </div>
    );
}
