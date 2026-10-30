"use client";

import { useEffect } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { getCustomDashboards } from "../custom-dashboards";

/** /custom redirects to the customer's first custom dashboard, 404 when there is none. */
export default function CustomIndexPage() {
    const params = useParams();
    const router = useRouter();
    const { customers, loading } = useCustomers();
    const customer = customers.find((c) => String(c._id) === String(params.customerId));
    const first = customer ? getCustomDashboards(customer)[0] : null;

    useEffect(() => {
        if (first) router.replace(`/dashboard/${params.customerId}/custom/${first.slug}`);
    }, [first, params.customerId, router]);

    if (first || loading || !customer) {
        if (!first && !loading && customers.length > 0) notFound();
        return <CobaltLoader variant="block" title="Loading dashboard" request="GET /api/customers" />;
    }
    notFound();
}
