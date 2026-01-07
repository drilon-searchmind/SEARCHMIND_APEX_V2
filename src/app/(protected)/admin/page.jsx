"use client";

import React, { useEffect, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import VerticalTabs from "./components/VerticalTabs";
import GeneralAppSettings from "./tabs/GeneralAppSettings";
import CustomersTab from "./tabs/CustomersTab";
import UsersTab from "./tabs/UsersTab";

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState("general");

    const tabs = [
        { key: "general", label: "General App Settings", content: <GeneralAppSettings /> },
        { key: "customers", label: "Customers", content: <CustomersTab /> },
        { key: "users", label: "Users", content: <UsersTab /> },
    ];

    return (
        <div id="AdminPage" className="w-full">
            <DashboardHeading title="Admin" label="Application Configuration" />
            <div className="bg-white border border-gray-200 rounded-xl">
                <VerticalTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
        </div>
    );
}