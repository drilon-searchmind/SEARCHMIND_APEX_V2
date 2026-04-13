import { notFound } from "next/navigation";
import { isValidApexRadarChannel } from "@/lib/apexRadarChannels";
import PerformanceInvestigatorClient from "../../../components/PerformanceInvestigatorClient";

export default async function ApexRadarPerformanceInvestigatorPage({ params }) {
    const { channel, customerId } = await params;
    if (!isValidApexRadarChannel(channel)) {
        notFound();
    }
    if (!customerId || typeof customerId !== "string") {
        notFound();
    }

    return <PerformanceInvestigatorClient channel={channel} customerId={customerId} />;
}
