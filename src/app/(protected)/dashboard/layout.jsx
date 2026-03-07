"use client"

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

const DashboardLayout = ({ children }) => {
    return (
        <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Topbar />
                <main className="flex-1 overflow-y-auto xl:px-20 lg:py10 bg-slate-50 py-10 px-4">{children}</main>
            </div>
        </div>
    );
};

export default DashboardLayout;