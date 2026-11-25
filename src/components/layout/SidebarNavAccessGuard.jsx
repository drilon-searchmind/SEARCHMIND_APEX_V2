"use client";

import React, { useEffect, useMemo } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import { getSidebarRestrictedRedirect } from "@/lib/customerDashboardHref";

/**
 * When Config → Sidebar hides Dashboard / Service Dashboard, block direct URLs
 * and send the user to the custom Performance overview (or Config fallback).
 */
export default function SidebarNavAccessGuard({ children }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const { customers, loading } = useCustomers();
    const customerId = params?.customerId;

    const customer = useMemo(() => {
        if (!customerId) return null;
        return customers.find((c) => String(c._id) === String(customerId)) || null;
    }, [customers, customerId]);

    useEffect(() => {
        if (loading || !customer || !pathname) return;
        const target = getSidebarRestrictedRedirect(customer, pathname);
        if (!target) return;
        const currentBase = pathname.split("?")[0];
        const targetBase = target.split("?")[0];
        if (currentBase === targetBase) return;
        router.replace(target);
    }, [loading, customer, pathname, router]);

    return children;
}
