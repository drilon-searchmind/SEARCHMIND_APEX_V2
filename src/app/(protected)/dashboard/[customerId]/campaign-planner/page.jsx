
"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CampaignsKanban from "./components/CampaignsKanban";
import CampaignsCalendar from "./components/CampaignsCalendar";
import CampaignsGantt from "./components/CampaignsGantt";
import CreateCampaignModal from "./components/CreateCampaignModal";
import { campaigns as staticCampaigns } from "./static-data/campaigns";

export default function CampaignPlannerPage() {
        // View options for toggling between Kanban, Calendar, and Gantt
        const viewOptions = [
            { label: "Kanban", value: "kanban" },
            { label: "Calendar", value: "calendar" },
            { label: "Gantt", value: "gantt" },
        ];
    const params = useParams();
    const customerId = params.customerId;
    const [campaigns, setCampaigns] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [view, setView] = useState("kanban");

    // Handle status change (drag-and-drop)
    const handleStatusChange = (id, newStatus) => {
        setCampaigns((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
        );
    };

    // Handle campaign creation (parent-child)
    const handleCreateCampaign = (newCampaigns) => {
        setCampaigns((prev) => [
            ...newCampaigns
                .filter((c) => !c.parent)
                .map((c) => ({
                    ...c,
                    customerId,
                    createdAt: c.createdAt || new Date().toISOString().slice(0, 10),
                    status: c.status || "Pending",
                    campaignName: c.campaignName,
                })),
            ...prev,
        ]);
    };

    // View toggle UI
    // Merge static and dynamic campaigns, deduplicate by id
    const mergedCampaigns = React.useMemo(() => {
        const all = [...staticCampaigns, ...campaigns];
        const seen = new Set();
        return all.filter(c => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
    }, [campaigns]);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Campaign Planner"
                label="Plan, create, and manage your campaigns"
                right={
                    <div className="flex items-center gap-4">
                        <div className="flex gap-1 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1">
                            {viewOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`px-3 py-1 rounded font-medium text-xs transition-colors duration-150 ${view === opt.value ? 'bg-[var(--color-primary-searchmind)] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                                    onClick={() => setView(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button
                            className="bg-[var(--color-primary-searchmind)] text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-opacity-90 transition"
                            onClick={() => setShowCreate(true)}
                        >
                            + Create Campaign
                        </button>
                    </div>
                }
            />
            {view === "kanban" && (
                <CampaignsKanban
                    customerId={customerId}
                    campaigns={mergedCampaigns}
                    onStatusChange={handleStatusChange}
                />
            )}
            {view === "calendar" && (
                <CampaignsCalendar
                    campaigns={mergedCampaigns}
                />
            )}
            {view === "gantt" && (
                <CampaignsGantt
                    campaigns={mergedCampaigns}
                />
            )}
            <CreateCampaignModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={handleCreateCampaign}
            />
        </div>
    );
}