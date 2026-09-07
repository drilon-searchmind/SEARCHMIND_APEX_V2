import { notFound } from "next/navigation";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";
import ApexRadarPerformanceBriefClient from "../ApexRadarPerformanceBriefClient";

export default async function ApexRadarPerformanceBriefCustomerPage({ params }) {
    const { customerId } = await params;
    if (!isPerformanceBriefCustomerId(customerId)) {
        notFound();
    }
    return <ApexRadarPerformanceBriefClient customerId={customerId} />;
}
