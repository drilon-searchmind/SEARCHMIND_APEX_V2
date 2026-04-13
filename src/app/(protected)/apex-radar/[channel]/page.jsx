import { notFound } from "next/navigation";
import { isValidApexRadarChannel } from "@/lib/apexRadarChannels";
import ApexRadarOverviewClient from "./ApexRadarOverviewClient";

export default async function ApexRadarChannelPage({ params }) {
    const { channel } = await params;
    if (!isValidApexRadarChannel(channel)) {
        notFound();
    }
    return <ApexRadarOverviewClient channel={channel} />;
}
