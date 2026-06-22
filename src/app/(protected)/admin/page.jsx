"use client";

import React, { useState } from "react";
import Link from "next/link";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import VerticalTabs from "./components/VerticalTabs";
import GeneralAppSettings from "./tabs/GeneralAppSettings";
import CustomersTab from "./tabs/CustomersTab";
import UsersTab from "./tabs/UsersTab";
import NotificationsTab from "./tabs/NotificationsTab";
import NewsTab from "./tabs/NewsTab";
import AuditPromptLibraryTab from "./tabs/AuditPromptLibraryTab";
import McpKeysTab from "./tabs/McpKeysTab";
import "./admin.css";

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
                <div className="apex-admin-tab">
                    <h2 className="apex-admin-section__title">MCP Route Requests</h2>
                    <p className="apex-admin-section__subtitle">
                        Review Claude MCP proxy access requests when a route is blocked by the
                        allowlist.
                    </p>
                    <Link href="/admin/route-requests" className="apex-perf-btn apex-perf-btn--primary w-fit">
                        Open route access requests
                    </Link>
                </div>
            ),
        },
    ];

    return (
        <div id="AdminPage" className="cobalt-perf w-full apex-admin-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Admin"
                label="Application Configuration"
            />
            <div className="apex-admin-panel">
                <VerticalTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
        </div>
    );
}
