"use client";

import React from "react";
import { DashboardViewProvider } from "@/contexts/DashboardViewContext";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import SidebarNavAccessGuard from "@/components/layout/SidebarNavAccessGuard";

export default function CustomerDashboardLayout({ children }) {
    return (
        <DashboardDataProvider>
            <DashboardViewProvider>
                <SidebarNavAccessGuard>{children}</SidebarNavAccessGuard>
            </DashboardViewProvider>
        </DashboardDataProvider>
    );
}
