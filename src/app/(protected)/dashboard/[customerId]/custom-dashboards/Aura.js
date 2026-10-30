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
    ],
};

export default aura;
