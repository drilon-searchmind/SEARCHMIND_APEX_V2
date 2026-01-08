
"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CampaignsKanban from "./components/CampaignsKanban";
import CreateCampaignModal from "./components/CreateCampaignModal";
import { campaigns as staticCampaigns } from "./static-data/campaigns";

export default function CampaignPlannerPage() {
    const params = useParams();
    const customerId = params.customerId;
    // For now, use static data. Later, fetch from API.
    const [campaigns, setCampaigns] = useState(staticCampaigns);
    const [showCreate, setShowCreate] = useState(false);



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
                .filter((c) => !c.parent) // Only add child campaigns to Kanban
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

    return (
        <div className="w-full">
            <DashboardHeading
                title="Campaign Planner"
                label="Plan, create, and manage your campaigns"
                right={
                    <button
                        className="bg-[var(--color-primary-searchmind)] text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-opacity-90 transition"
                        onClick={() => setShowCreate(true)}
                    >
                        + Create Campaign
                    </button>
                }
            />
            <CampaignsKanban
                customerId={customerId}
                campaigns={campaigns}
                onStatusChange={handleStatusChange}
            />
            <CreateCampaignModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreate={handleCreateCampaign}
            />
        </div>
    );
}