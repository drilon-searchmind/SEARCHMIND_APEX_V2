"use client"

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import "../home/home.css";
import "./dashboard-shell.css";

const DashboardLayout = ({ children }) => {
    return (
        <div className="apex-dashboard flex h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <main className="apex-dash__content">{children}</main>
            </div>
        </div>
    );
};

export default DashboardLayout;
