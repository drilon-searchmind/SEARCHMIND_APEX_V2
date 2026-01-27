import React, { useState } from "react";
import { FiChevronDown, FiChevronRight, FiPlus } from "react-icons/fi";

const STATUS_COLORS = {
    "Pending": "bg-yellow-100 text-yellow-800",
    "Pending Customer Approval": "bg-orange-100 text-orange-800",
    "Approved": "bg-blue-100 text-blue-800",
    "Live": "bg-green-100 text-green-800",
    "Ended": "bg-gray-100 text-gray-800",
};

const SERVICE_COLORS = {
    "Paid Social": "#dbeafe", // light blue
    "Paid Search": "#dcfce7", // light green
    "Email Marketing": "#e9d5ff", // light purple
    "SEO": "#fed7aa", // light orange
};

export default function ParentCampaignsList({
    campaigns,
    onViewDetails,
    onCreateChild,
    customerId
}) {
    const [expandedParents, setExpandedParents] = useState({});
    const [sortBy, setSortBy] = useState('name'); // 'name', 'startDate', 'endDate'
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

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

    // Calculate allocated budget for a parent campaign
    const getAllocatedBudget = (parentId) => {
        const children = getChildrenForParent(parentId);
        return children.reduce((sum, child) => {
            return sum + (child.budget || 0);
        }, 0);
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

    // Sort parent campaigns
    const sortedParentCampaigns = [...parentCampaigns].sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
            case 'startDate':
                aValue = a.startDate ? new Date(a.startDate) : new Date(0);
                bValue = b.startDate ? new Date(b.startDate) : new Date(0);
                break;
            case 'endDate':
                aValue = a.endDate ? new Date(a.endDate) : new Date(0);
                bValue = b.endDate ? new Date(b.endDate) : new Date(0);
                break;
            case 'name':
            default:
                aValue = a.campaignName || '';
                bValue = b.campaignName || '';
                break;
        }

        if (sortOrder === 'asc') {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
    });

    return (
        <div className="w-full">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Parent Campaigns</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Sort by:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                                <option value="name">Name</option>
                                <option value="startDate">Start Date</option>
                                <option value="endDate">End Date</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="text-sm border border-gray-300 rounded px-2 py-1 hover:bg-gray-100"
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="divide-y divide-gray-200">
                    {parentCampaigns.length === 0 ? (
                        <div className="px-6 py-8 text-center text-gray-500">
                            No parent campaigns found. Create one to get started.
                        </div>
                    ) : (
                        sortedParentCampaigns.map((parent) => {
                            const isExpanded = expandedParents[parent._id];
                            const children = getChildrenForParent(parent._id);
                            
                            return (
                                <div key={parent._id} className="hover:bg-gray-50 transition-colors border-b-2 border-gray-300 border-dotted">
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
                                                <div className="mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-gray-900 text-base cursor-pointer hover:text-blue-600 transition-colors" onClick={(e) => { e.stopPropagation(); onViewDetails(parent); }} title="Click to view campaign details">{parent.campaignName}</h4>
                                                        <svg className="w-4 h-4 text-gray-400 cursor-pointer hover:text-blue-500 transition-colors" onClick={(e) => { e.stopPropagation(); onViewDetails(parent); }} title="Click to view campaign details" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-800">
                                                    <span>Services: {parent.services?.join(", ") || "N/A"}</span>
                                                    <span className="font-bold">Budget: {formatCurrency(parent.totalBudget)}</span>
                                                    <span className="text-gray-600">Allocated: {formatCurrency(getAllocatedBudget(parent._id))}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                                <span>
                                                    {parent.startDate ? new Date(parent.startDate).toLocaleDateString('da-DK') : 'No start'}
                                                </span>
                                                <span>-</span>
                                                <span>
                                                    {parent.alwaysOn ? 'Always On' : (parent.endDate ? new Date(parent.endDate).toLocaleDateString('da-DK') : 'No end')}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewDetails(parent);
                                                }}
                                                className="px-3 py-1 bg-gray-100 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
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

                                    {/* Expanded Children - Table Format */}
                                    {isExpanded && (
                                        <div className="bg-gray-50 border-t border-gray-200 overflow-x-auto py-4">
                                            {children.length === 0 ? (
                                                <div className="px-12 py-4 text-sm text-gray-500">
                                                    No child campaigns yet. Click "Add Child" to create one.
                                                </div>
                                            ) : (
                                                <div className="px-6 py-4">
                                                    {/* Table Header */}
                                                    <div className="grid grid-cols-12 gap-4 px-4 py-3 font-semibold text-[0.65rem] uppercase tracking-wide bg-[#406969] text-white rounded">
                                                        <div className="col-span-3">Campaign Name</div>
                                                        <div className="col-span-1">Service</div>
                                                        <div className="col-span-1 flex items-center gap-1">
                                                            Media
                                                        </div>
                                                        <div className="col-span-1">Budget</div>
                                                        <div className="col-span-2">Status</div>
                                                        <div className="col-span-2">Issues</div>
                                                        <div className="col-span-2 text-right">Actions</div>
                                                    </div>
                                                    
                                                    {/* Table Rows */}
                                                    <div className="divide-y divide-gray-200">
                                                        {children.map((child) => {
                                                            const dwarfs = getDwarfsForChild(child._id);
                                                            const missingFields = getMissingFields(child);
                                                            
                                                            return (
                                                                <div key={child._id} className="bg-white hover:bg-gray-50 transition-colors">
                                                                    {/* Child Campaign Row */}
                                                                    <div className="grid grid-cols-12 gap-4 px-4 py-3 items-center text-sm border-b border-gray-100">
                                                                        {/* Campaign Name */}
                                                                        <div className="col-span-3">
                                                                            <div className="font-medium text-gray-900">{child.campaignName}</div>
                                                                        </div>
                                                                        
                                                                        {/* Service */}
                                                                        <div className="col-span-1">
                                                                            <div className="flex items-center gap-1">
                                                                                <div
                                                                                    className="w-2 h-2 rounded-full"
                                                                                    style={{ backgroundColor: SERVICE_COLORS[child.service] || '#6b7280' }}
                                                                                    title={child.service}
                                                                                ></div>
                                                                                <span className="text-gray-700 text-sm">{child.service || "N/A"}</span>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Media */}
                                                                        <div className="col-span-1 text-gray-700">
                                                                            {child.media || "N/A"}
                                                                        </div>
                                                                        
                                                                        {/* Budget */}
                                                                        <div className="col-span-1 text-gray-700 font-medium">
                                                                            {formatCurrency(child.budget)}
                                                                        </div>
                                                                        
                                                                        {/* Status */}
                                                                        <div className="col-span-2">
                                                                            <span className={`px-2 py-1 rounded text-[0.65rem] font-medium ${STATUS_COLORS[child.status] || STATUS_COLORS["Pending"]}`}>
                                                                                {child.status}
                                                                            </span>
                                                                        </div>
                                                                        
                                                                        {/* Issues */}
                                                                        <div className="col-span-2">
                                                                            {missingFields.length > 0 ? (
                                                                                <span className="text-[0.65rem] px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                                                    Missing: {missingFields.join(", ")}
                                                                                </span>
                                                                            ) : child.status === "Pending Customer Approval" ? (
                                                                                <span className="text-[0.65rem] px-2 py-1 bg-orange-100 text-orange-800 rounded">
                                                                                    Pending Customer Approval
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-gray-400">-</span>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Actions */}
                                                                        <div className="col-span-2 flex items-center justify-end gap-2">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onViewDetails(child);
                                                                                }}
                                                                                className="px-3 py-1.5 bg-gray-100 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                                                                            >
                                                                                View
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const childId = child._id || child.id;
                                                                                    onCreateChild({ 
                                                                                        parentCampaignId: childId, 
                                                                                        isDwarf: true 
                                                                                    });
                                                                                }}
                                                                                className="px-3 py-1.5 text-xs bg-gray-300 text-gray-700 hover:bg-gray-300 rounded flex items-center gap-1 transition-colors"
                                                                            >
                                                                                <FiPlus size={12} />
                                                                                Add Line Item
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Dwarf Campaigns List */}
                                                                    {dwarfs.length > 0 && (
                                                                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                                                                            <div className="ml-4 space-y-0.5">
                                                                                {dwarfs.map((dwarf) => (
                                                                                    <div key={dwarf._id} className="text-xs text-gray-800  px-2 py-2 rounded bg-gray-100">
                                                                                        ㄴ {dwarf.campaignName}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
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
