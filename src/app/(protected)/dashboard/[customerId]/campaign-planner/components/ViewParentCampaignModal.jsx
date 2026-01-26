import React from "react";
import { FiX, FiInfo, FiCalendar, FiDollarSign, FiUsers } from "react-icons/fi";

export default function ViewParentCampaignModal({ open, onClose, campaign, childCampaigns = [] }) {
    if (!open || !campaign) return null;

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
                                <p className="text-xl font-bold text-gray-900">
                                    {formatCurrency(campaign.totalBudget)}
                                </p>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                            className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h4 className="font-semibold text-gray-900 text-sm">{child.campaignName}</h4>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(child.status)}`}>
                                                    {child.status}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1">
                                                <p>Service: {child.service || "N/A"}</p>
                                                <p>Media: {child.media || "N/A"}</p>
                                                <p>Budget: {formatCurrency(child.budget)}</p>
                                            </div>
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
