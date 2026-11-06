"use client";

import React from "react";
import { useParams, notFound } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { findCustomDashboard } from "../../custom-dashboards";

/** Renders one hardcoded custom dashboard. 404 when the setting is off or the customer has no such dashboard. */
export default function CustomDashboardPage() {
    const params = useParams();
    const { customers, loading } = useCustomers();
    const customer = customers.find((c) => String(c._id) === String(params.customerId));

    if (!customer) {
        if (loading || customers.length === 0) {
            return <CobaltLoader variant="block" title="Loading dashboard" request="GET /api/customers" />;
        }
        notFound();
    }
    const dashboard = findCustomDashboard(customer, params.slug);
    if (!dashboard) notFound();

    const Dashboard = dashboard.Component;
    return <Dashboard customer={customer} />;
}
