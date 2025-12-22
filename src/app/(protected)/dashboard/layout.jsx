"use client"

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

const DashboardLayout = ({ children }) => {
    const user = {
        name: "Drilon",
        lastName: "Braha",
        image: "/images/user.jpg",
        theme: "light",
        userEmail: "drilon.braha@example.com"
    };

    const handleToggleTheme = () => {
        user.theme = user.theme === "light" ? "dark" : "light";
    };

    return (
        <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Topbar user={user} onToggleTheme={handleToggleTheme} />
                <main className="flex-1 overflow-y-auto p-8 bg-slate-50">{children}</main>
            </div>
        </div>
    );
};

export default DashboardLayout;