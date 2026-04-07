"use client"

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

const DashboardLayout = ({ children }) => {
    return (
        <div className="flex h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-10 xl:px-20">{children}</main>
            </div>
        </div>
    );
};

export default DashboardLayout;