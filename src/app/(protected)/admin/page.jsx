"use client";

import React, { useEffect, useState } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import VerticalTabs from "./components/VerticalTabs";
import GeneralAppSettings from "./tabs/GeneralAppSettings";
import CustomersTab from "./tabs/CustomersTab";
import UsersTab from "./tabs/UsersTab";
import NotificationsTab from "./tabs/NotificationsTab";
import NewsTab from "./tabs/NewsTab";
import AuditPromptLibraryTab from "./tabs/AuditPromptLibraryTab";
import McpKeysTab from "./tabs/McpKeysTab";

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState("general");

    const tabs = [
        { key: "general", label: "General App Settings", content: <GeneralAppSettings /> },
        { key: "customers", label: "Customers", content: <CustomersTab /> },
        { key: "users", label: "Users", content: <UsersTab /> },
        { key: "notifications", label: "Notifications", content: <NotificationsTab /> },
        { key: "news", label: "News", content: <NewsTab /> },
        { key: "audit-prompts", label: "Audit Prompt Library", content: <AuditPromptLibraryTab /> },
        { key: "mcp-keys", label: "MCP API Keys", content: <McpKeysTab /> },
        {
            key: "route-requests",
            label: "MCP Route Requests",
            content: (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Review Claude MCP proxy access requests when a route is blocked by the
                        allowlist.
                    </p>
                    <a
                        href="/admin/route-requests"
                        className="inline-flex items-center rounded-lg bg-gray-900 text-white px-4 py-2 text-sm hover:bg-gray-800"
                    >
                        Open route access requests
                    </a>
                </div>
            ),
        },
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