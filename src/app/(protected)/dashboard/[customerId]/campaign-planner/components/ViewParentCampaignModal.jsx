import React, { useState, useEffect } from "react";
import { FiX, FiInfo, FiCalendar, FiDollarSign, FiUsers, FiTrash2, FiAlertTriangle } from "react-icons/fi";

// Mapping ClickUp service IDs to campaign service names
const CLICKUP_TO_CAMPAIGN_SERVICES = {
    "51ed563e-4a2c-489b-9506-be385c49a354": "SEO", // SEO
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "Paid Search", // PPC
    "2df85265-d5eb-4e86-a111-5d55623851fa": "Paid Social", // PS
    "55b3e92d-5972-4246-8160-73d7ba04401a": "Email Marketing", // EM
};

export default function ViewParentCampaignModal({ open, onClose, campaign, childCampaigns = [], onDelete, onViewChild }) {
    const [clickupUsers, setClickupUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    if (!open || !campaign) return null;

    // Check if parent campaign has missing required fields
    const getMissingFieldsForParent = (campaign) => {
        const missing = [];
        if (!campaign.campaignName) missing.push("Campaign Name");
        if (!campaign.services || campaign.services.length === 0) missing.push("Services");
        if (!campaign.countryCode) missing.push("Country Code");
        if (!campaign.totalBudget) missing.push("Total Budget");
        if (!campaign.startDate) missing.push("Start Date");
        if (!campaign.endDate && !campaign.alwaysOn) missing.push("End Date");
        return missing;
    };

    const parentMissingFields = getMissingFieldsForParent(campaign);

    // Fetch ClickUp users when modal opens
    useEffect(() => {
        const fetchClickupUsers = async () => {
            if (!campaign.customerId) return;
            setLoadingUsers(true);
            try {
                const response = await fetch(`/api/clickup-team-members/${campaign.customerId}`);
                if (response.ok) {
                    const data = await response.json();
                    setClickupUsers(data.members || []);
                }
            } catch (error) {
                console.error('Error fetching ClickUp users:', error);
            } finally {
                setLoadingUsers(false);
            }
        };

        if (open) {
            fetchClickupUsers();
        }
    }, [open, campaign.customerId]);

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

    const formatDate = (date) => {
        if (!date) return "N/A";
        return new Date(date).toLocaleDateString('da-DK');
    };

    const formatCurrency = (amount) => {
        if (!amount) return "N/A";
        return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(amount);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
            <div className="bg-white rounded-xl shadow-2xl w-[80vw] max-h-[90vh] relative overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-[var(--color-primary-searchmind)] text-white px-8 py-6 flex items-center justify-between">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-1">Parent Campaign Details</h2>
                        <p className="text-sm text-white/80">{campaign.campaignName}</p>
                    </div>
                    <button
                        className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <FiX size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-8">
                    <div className="grid grid-cols-2 gap-8">
                        {/* Column 1: Campaign Information */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                                <FiInfo className="text-[var(--color-primary-searchmind)]" size={18} />
                                <h3 className="text-base font-semibold text-gray-900">Campaign Information</h3>
                            </div>

                            {/* Missing Fields Warning */}
                            {parentMissingFields.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <FiAlertTriangle className="text-red-500" size={16} />
                                        <span className="text-sm font-medium text-red-800">Missing Required Fields</span>
                                    </div>
                                    <ul className="text-sm text-red-700 space-y-1">
                                        {parentMissingFields.map((field, idx) => (
                                            <li key={idx}>• {field}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Campaign Name</p>
                                <p className="text-sm font-semibold text-gray-900">{campaign.campaignName}</p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Services</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {campaign.services && campaign.services.length > 0 ? (
                                        campaign.services.map((service, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                {service}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-500">N/A</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Media</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {campaign.media && campaign.media.length > 0 ? (
                                        campaign.media.map((media, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                                {media}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-500">N/A</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Responsible</p>
                                <span className={`px-3 py-1 rounded text-sm font-medium ${
                                    campaign.responsible === "kunde" 
                                        ? "bg-orange-100 text-orange-800" 
                                        : "bg-blue-100 text-blue-800"
                                }`}>
                                    {campaign.responsible === "kunde" ? "Kunde" : "Searchmind"}
                                </span>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Country Code</p>
                                <p className="text-sm text-gray-700">{campaign.countryCode || "N/A"}</p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Always On</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {campaign.alwaysOn ? "✓ Yes" : "✗ No"}
                                </p>
                            </div>
                        </div>

                        {/* Column 2: Timeline & Budget */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                                <FiCalendar className="text-[var(--color-primary-searchmind)]" size={18} />
                                <h3 className="text-base font-semibold text-gray-900">Timeline & Budget</h3>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">Start Date</p>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {formatDate(campaign.startDate)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">End Date</p>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {campaign.alwaysOn ? "Always On" : formatDate(campaign.endDate)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[var(--color-secondary-searchmind)]/10 rounded-lg p-4 border border-[var(--color-secondary-searchmind)]/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <FiDollarSign className="text-[var(--color-primary-searchmind)]" size={16} />
                                    <p className="text-xs font-medium text-gray-500">Total Budget</p>
                                </div>
                                <p className="text-xl font-bold text-gray-900 mb-2">
                                    {formatCurrency(campaign.totalBudget)}
                                </p>
                                <div className="border-t border-gray-200 pt-2">
                                    <p className="text-sm text-gray-600">Allocated Budget</p>
                                    <p className="text-sm font-medium text-gray-800">
                                        {formatCurrency(childCampaigns.reduce((sum, child) => sum + (child.budget || 0), 0))}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Comment</p>
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mt-1">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {campaign.comment || "No comment"}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Created At</p>
                                <p className="text-sm text-gray-700">
                                    {campaign.createdAt ? formatDate(campaign.createdAt) : "N/A"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Child Campaigns Section */}
                    <div className="mt-8 border-t border-gray-200 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FiUsers className="text-[var(--color-primary-searchmind)]" size={18} />
                            <h3 className="text-base font-semibold text-gray-900">
                                Child Campaigns ({childCampaigns.length})
                            </h3>
                        </div>
                        {childCampaigns.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No child campaigns created yet.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {childCampaigns.map((child) => {
                                    const getStatusColor = (status) => {
                                        switch (status) {
                                            case "Live": return "bg-green-100 text-green-800";
                                            case "Approved": return "bg-blue-100 text-blue-800";
                                            case "Pending": return "bg-yellow-100 text-yellow-800";
                                            case "Pending Customer Approval": return "bg-orange-100 text-orange-800";
                                            case "Ended": return "bg-gray-100 text-gray-800";
                                            default: return "bg-gray-100 text-gray-800";
                                        }
                                    };

                                    return (
                                        <div
                                            key={child._id}
                                            className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                                            onClick={() => onViewChild && onViewChild(child)}
                                            title="Click to view campaign details"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors truncate">{child.campaignName}</h4>
                                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(child.status)}`}>
                                                        {child.status}
                                                    </span>
                                                    {onDelete && (
                                                        <button
                                                            onClick={async () => {
                                                                if (window.confirm(`Are you sure you want to delete "${child.campaignName}"? This will also delete any related line items.`)) {
                                                                    try {
                                                                        await onDelete(child._id || child.id);
                                                                    } catch (error) {
                                                                        console.error("Error deleting child campaign:", error);
                                                                        alert("Failed to delete child campaign");
                                                                    }
                                                                }
                                                            }}
                                                            className="px-2 py-1 text-xs text-red-600 hover:text-red-900 hover:bg-red-50 rounded flex items-center gap-1"
                                                        >
                                                            <FiTrash2 size={12} />
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 text-xs text-gray-600">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium">Service:</span>
                                                    <span>{child.service || "N/A"}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium">Media:</span>
                                                    <span>{child.media || "N/A"}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium">Budget:</span>
                                                    <span>{formatCurrency(child.budget)}</span>
                                                </div>
                                            </div>

                                            {/* Assigned Users for this child campaign */}
                                            {child.service && (() => {
                                                const campaignUsers = getCampaignUsers(child);
                                                return campaignUsers.length > 0 ? (
                                                    <div className="mt-2">
                                                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                                                            <span className="font-medium">Assigned:</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {campaignUsers.slice(0, 3).map((userId) => {
                                                                const user = clickupUsers.find(u => u.id === userId);
                                                                return (
                                                                    <div
                                                                        key={userId}
                                                                        className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0"
                                                                        title={user?.username || `User ${userId.slice(-4)}`}
                                                                    >
                                                                        {user?.avatar ? (
                                                                            <img
                                                                                src={user.avatar}
                                                                                alt={user.username}
                                                                                className="w-5 h-5 rounded-full object-cover"
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
                                                                <div className="w-5 h-5 rounded-full bg-[var(--color-primary-searchmind-lighter)] flex items-center justify-center flex-shrink-0">
                                                                    <span className="text-xs font-light text-gray-50">
                                                                        +{campaignUsers.length - 3}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-8 py-4 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg font-semibold border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
