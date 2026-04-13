import { notFound } from "next/navigation";
import { isValidApexRadarChannel } from "@/lib/apexRadarChannels";
import ApexRadarOverviewClient from "../ApexRadarOverviewClient";

export default async function ApexRadarCustomerOverviewPage({ params }) {
    const { channel, customerId } = await params;
    if (!isValidApexRadarChannel(channel)) {
        notFound();
    }
    if (!customerId || typeof customerId !== "string") {
        notFound();
    }
    return <ApexRadarOverviewClient channel={channel} customerId={customerId} />;
}
