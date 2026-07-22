"use client";

import React from "react";
import { DashboardViewProvider } from "@/contexts/DashboardViewContext";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";

export default function CustomerDashboardLayout({ children }) {
    return (
        <DashboardDataProvider>
            <DashboardViewProvider>{children}</DashboardViewProvider>
        </DashboardDataProvider>
    );
}
