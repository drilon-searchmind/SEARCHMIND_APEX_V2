import { notFound } from "next/navigation";
import { isApexRadarCsCustomerId } from "@/lib/apexRadarCsConstants";
import ApexRadarCsClient from "../ApexRadarCsClient";

export default async function ApexRadarCsCustomerPage({ params }) {
    const { customerId } = await params;
    if (!isApexRadarCsCustomerId(customerId)) {
        notFound();
    }
    return <ApexRadarCsClient customerId={customerId} />;
}
