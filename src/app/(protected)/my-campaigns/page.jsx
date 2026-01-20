"use client";

import React, { useState, useEffect, useMemo } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import ViewCampaignModal from "@/app/(protected)/dashboard/[customerId]/campaign-planner/components/ViewCampaignModal";
import FormButton from "@/components/form/FormButton";
import { useUser } from "@/contexts/UserContext";
import { showToast } from "@/components/ui/ToastProvider";

const STATUS_COLORS = {
    Pending: "bg-yellow-100 text-yellow-800",
    "Pending Customer Approval": "bg-orange-100 text-orange-800",
    Approved: "bg-blue-100 text-blue-800",
    Live: "bg-green-100 text-green-800",
    Ended: "bg-gray-100 text-gray-800",
};

const STATUS = ["Pending", "Pending Customer Approval", "Approved", "Live", "Ended"];
const SERVICES = ["Paid Social", "Paid Search", "Email Marketing", "SEO"];
const MEDIA = ["META", "LinkedIn", "Pinterest", "TikTok", "YouTube", "Google", "Email", "Website", "Other"];
const FORMATS = ["Video", "Picture", "Carousel", "Display Ad", "Search Ad", "Newsletter", "Email Flow", "Landingpage", "Collection"];

export default function MyCampaigns() {
    const sessionUser = useUser();
    const userId = sessionUser?._id || sessionUser?.id || sessionUser?.userId || null;
    const [campaigns, setCampaigns] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [customerFilter, setCustomerFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [mediaFilter, setMediaFilter] = useState("");
    const [formatFilter, setFormatFilter] = useState("");
    const [sortField, setSortField] = useState("campaignName");
    const [sortDirection, setSortDirection] = useState("asc");
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                const [campaignsResponse, customersResponse] = await Promise.all([
                    fetch(`/api/user-campaigns/${userId}`),
                    fetch('/api/customers')
                ]);

                if (!campaignsResponse.ok) {
                    throw new Error('Failed to fetch campaigns');
                }

                const campaignData = await campaignsResponse.json();
                const customerData = await customersResponse.json();

                setCampaigns(campaignData);
                setCustomers(customerData);
            } catch (error) {
                console.error('Error fetching data:', error);
                showToast({ type: "error", message: "Failed to load your campaigns" });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    const getCustomerName = (customerId) => {
        const customer = customers.find(c => c._id === customerId || String(c._id) === String(customerId));
        return customer?.customerName || 'Unknown Customer';
    };

    // Get unique customers from campaigns
    const availableCustomers = useMemo(() => {
        const customerIds = [...new Set(campaigns.map(c => c.customerId))];
        return customers.filter(c => customerIds.includes(String(c._id)) || customerIds.includes(c._id));
    }, [campaigns, customers]);

    // Filter and sort campaigns
    const filteredAndSortedCampaigns = useMemo(() => {
        let filtered = campaigns.filter(campaign => {
            const matchesSearch = !search ||
                campaign.campaignName.toLowerCase().includes(search.toLowerCase()) ||
                campaign.service?.toLowerCase().includes(search.toLowerCase()) ||
                campaign.media?.toLowerCase().includes(search.toLowerCase()) ||
                getCustomerName(campaign.customerId).toLowerCase().includes(search.toLowerCase());

            const matchesCustomer = !customerFilter ||
                String(campaign.customerId) === customerFilter ||
                campaign.customerId === customerFilter;

            const matchesStatus = !statusFilter || campaign.status === statusFilter;
            const matchesService = !serviceFilter || campaign.service === serviceFilter;
            const matchesMedia = !mediaFilter || campaign.media === mediaFilter;
            const matchesFormat = !formatFilter || campaign.campaignFormat === formatFilter;

            return matchesSearch && matchesCustomer && matchesStatus && matchesService && matchesMedia && matchesFormat;
        });

        // Sort campaigns
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (sortField) {
                case "campaignName":
                    aValue = a.campaignName || "";
                    bValue = b.campaignName || "";
                    break;
                case "customer":
                    aValue = getCustomerName(a.customerId);
                    bValue = getCustomerName(b.customerId);
                    break;
                case "status":
                    aValue = a.status || "";
                    bValue = b.status || "";
                    break;
                case "service":
                    aValue = a.service || "";
                    bValue = b.service || "";
                    break;
                case "budget":
                    aValue = a.budget || 0;
                    bValue = b.budget || 0;
                    break;
                case "startDate":
                    aValue = a.startDate ? new Date(a.startDate).getTime() : 0;
                    bValue = b.startDate ? new Date(b.startDate).getTime() : 0;
                    break;
                default:
                    aValue = a.campaignName || "";
                    bValue = b.campaignName || "";
            }

            if (typeof aValue === 'string') {
                return sortDirection === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            } else {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
        });

        return filtered;
    }, [campaigns, search, customerFilter, statusFilter, serviceFilter, mediaFilter, formatFilter, sortField, sortDirection, customers]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const handleViewCampaign = (campaign) => {
        console.log({ campaign });
        setSelectedCampaign(campaign);
        setViewModalOpen(true);
    };

    const handleCloseModal = () => {
        setViewModalOpen(false);
        setSelectedCampaign(null);
    };

    return (
        <div className="w-full">
            <DashboardHeading
                title="My Campaigns"
                label={`${filteredAndSortedCampaigns.length} campaign${filteredAndSortedCampaigns.length !== 1 ? 's' : ''} assigned to you`}
                right={null}
            />

            {/* Search and Filter Bar */}
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
                            value={customerFilter}
                            onChange={(e) => setCustomerFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                        >
                            <option value="">All Customers</option>
                            {availableCustomers.map((customer) => (
                                <option key={customer._id} value={customer._id}>
                                    {customer.customerName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-[150px]">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
                        >
                            <option value="">All Statuses</option>
                            {STATUS.map((status) => (
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
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-searchmind)]"></div>
                    <span className="ml-3 text-gray-600">Loading your campaigns...</span>
                </div>
            ) : filteredAndSortedCampaigns.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                    <div className="text-gray-400 text-lg mb-2">No campaigns found</div>
                    <p className="text-gray-500">
                        {search || customerFilter
                            ? "Try adjusting your search or filter criteria."
                            : "You haven't been assigned to any campaigns yet."}
                    </p>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('campaignName')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Campaign Name
                                            <SortIcon field="campaignName" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('customer')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Customer
                                            <SortIcon field="customer" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('service')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Service
                                            <SortIcon field="service" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Media
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Format
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('budget')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Budget
                                            <SortIcon field="budget" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('startDate')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Start Date
                                            <SortIcon field="startDate" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center gap-2">
                                            Status
                                            <SortIcon field="status" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAndSortedCampaigns.map((campaign) => (
                                    <tr key={campaign._id || campaign.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{campaign.campaignName}</div>
                                            {campaign.messageBrief && (
                                                <div className="text-xs text-gray-500 mt-1">{campaign.messageBrief}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{getCustomerName(campaign.customerId)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{campaign.service || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{campaign.media || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{campaign.campaignFormat || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {campaign.budget ? `${campaign.budget.toLocaleString('da-DK')} DKK` : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString('da-DK') : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[campaign.status] || "bg-gray-100 text-gray-800"}`}>
                                                {campaign.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span onClick={() => handleViewCampaign(campaign)}>
                                                <FormButton
                                                    buttonSize="small"
                                                    className="px-3 py-1 text-xs"
                                                >
                                                    View
                                                </FormButton>
                                            </span>

                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* View Campaign Modal */}
            <ViewCampaignModal
                open={viewModalOpen}
                onClose={handleCloseModal}
                campaign={selectedCampaign}
            />
        </div>
    );
}