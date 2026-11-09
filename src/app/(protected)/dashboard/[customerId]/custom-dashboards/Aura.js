import dynamic from "next/dynamic";

/** Custom dashboards for Aura DK (replaces the Supermetrics Google Sheets dashboard). */
const aura = {
    /** Matched (case-insensitive) against Customer.customerName. */
    customerNames: ["Aura DK"],
    dashboards: [
        {
            slug: "performance",
            label: "Performance",
            Component: dynamic(() => import("./aura/AuraPerformanceDashboard"), { ssr: false }),
        },
        {
            slug: "pace",
            label: "Pace report",
            Component: dynamic(() => import("./aura/AuraPaceReport"), { ssr: false }),
        },
        {
            slug: "overview-day",
            label: "Overview day",
            Component: dynamic(() => import("./aura/AuraOverviewDay"), { ssr: false }),
        },
        {
            slug: "inputs",
            label: "Data inputs",
            Component: dynamic(() => import("./aura/AuraInputs"), { ssr: false }),
        },
    ],
};

export default aura;
