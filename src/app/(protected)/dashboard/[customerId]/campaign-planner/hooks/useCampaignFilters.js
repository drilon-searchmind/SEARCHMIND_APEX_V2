import { useState, useMemo } from "react";

const CAMPAIGN_STATUSES = ["Pending", "Pending Customer Approval", "Approved", "Live", "Ended"];
const SERVICES = ["Paid Social", "Paid Search", "Email Marketing", "SEO"];
const FORMATS = ["Video", "Picture", "Carousel", "Display Ad", "Search Ad", "Newsletter", "Email Flow", "Landingpage", "Collection"];

export default function useCampaignFilters(campaigns = []) {
    // Default date range: first of current month to end of current month
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");

    // First day of current month
    const defaultStart = `${yyyy}-${mm}-01`;

    // Last day of current month
    const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate();
    const defaultEnd = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`;

    const [dateRange, setDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [serviceFilter, setServiceFilter] = useState("");
    const [parentFilter, setParentFilter] = useState("");

    // Get available filter options from campaigns
    const availableStatuses = useMemo(() => {
        const statuses = new Set(campaigns.filter(c => c.status).map(c => c.status));
        return ["", ...Array.from(statuses).sort()];
    }, [campaigns]);

    const availableServices = useMemo(() => {
        const services = new Set(campaigns.filter(c => c.service).map(c => c.service));
        return ["", ...Array.from(services).sort()];
    }, [campaigns]);


    const parentCampaigns = useMemo(() => {
        return campaigns.filter(c => c.campaignLevel === "parent" || (!c.campaignLevel && !c.parentCampaignId && c.services));
    }, [campaigns]);

    // Filter campaigns function
    const filterCampaigns = (campaignsToFilter) => {
        return campaignsToFilter.filter((c) => {
            // Search filter
            if (search && !String(c.campaignName || "").toLowerCase().includes(search.toLowerCase())) return false;

            // Status filter
            if (statusFilter && c.status !== statusFilter) return false;

            // Service filter
            if (serviceFilter && c.service !== serviceFilter) return false;

            // Parent campaign filter
            if (parentFilter && c.parentCampaignId !== parentFilter) return false;


            // Date range filter - only show campaigns that overlap with selected date range
            const campaignStart = c.startDate ? new Date(c.startDate) : null;
            const campaignEnd = c.endDate ? new Date(c.endDate) : null;
            const rangeStart = new Date(dateRange.startDate);
            const rangeEnd = new Date(dateRange.endDate);

            // Campaign overlaps with range if:
            // - Campaign starts before range end AND ends after range start (or has no end)
            // - OR campaign has no start date (always show these?)
            if (!campaignStart) return true; // Campaigns with no start date are always shown

            // For campaigns with start date, check overlap
            const effectiveEnd = campaignEnd || new Date('2099-12-31'); // Treat no end as far future
            return campaignStart <= rangeEnd && effectiveEnd >= rangeStart;
        });
    };

    return {
        // Filter states
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

        // Available options
        availableStatuses,
        availableServices,
        parentCampaigns,

        // Utility function
        filterCampaigns
    };
}