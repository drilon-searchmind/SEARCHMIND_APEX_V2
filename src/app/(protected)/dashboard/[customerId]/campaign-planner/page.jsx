
"use client";

import React, { useState } from "react";
import useCampaigns from "./hooks/useCampaigns";
import { useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import CampaignsKanban from "./components/CampaignsKanban";
import CampaignsCalendar from "./components/CampaignsCalendar";
import CampaignsGantt from "./components/CampaignsGantt";
import CreateParentCampaignModal from "./components/CreateParentCampaignModal";
import CreateChildCampaignModal from "./components/CreateChildCampaignModal";
import ParentCampaignsList from "./components/ParentCampaignsList";
import ViewCampaignModal from "./components/ViewCampaignModal";
import ViewParentCampaignModal from "./components/ViewParentCampaignModal";
import FormButton from "@/components/form/FormButton";

export default function CampaignPlannerPage() {
    const [viewCampaign, setViewCampaign] = useState(null);
    const [viewParentCampaign, setViewParentCampaign] = useState(null);
    const user = useUser();
    // View options for toggling between Parent Campaigns, Overview, Calendar, and Gantt
    const viewOptions = [
        { label: "Overview", value: "parents" },
        { label: "Kanban", value: "kanban" },
        { label: "Calendar", value: "calendar" },
        { label: "Gantt", value: "gantt" },
    ];
    const params = useParams();
    const customerId = params.customerId;
    const {
        campaigns,
        loading,
        error,
        createCampaigns,
        updateCampaign,
        deleteCampaign,
        fetchCampaigns,
    } = useCampaigns(customerId);
    const [showCreateParent, setShowCreateParent] = useState(false);
    const [showCreateChild, setShowCreateChild] = useState(null);
    const [view, setView] = useState("parents");
    const [showDwarfCampaigns, setShowDwarfCampaigns] = useState(false);

    // Handle status change (drag-and-drop)
    const handleStatusChange = async (id, newStatus) => {
        await updateCampaign(id, { status: newStatus });
        await fetchCampaigns();
    };

    // Handle parent campaign creation
    const handleCreateParentCampaign = async (parentCampaign) => {
        // Create parent campaign first
        const created = await createCampaigns([parentCampaign]);
        const createdParent = Array.isArray(created) ? created[0] : created;
        
        if (!createdParent || !createdParent._id) {
            console.error("Failed to create parent campaign");
            return;
        }

        // Auto-create child campaigns for each service+media combination
        // Create a child campaign for each service + each selected media
        const childCampaigns = [];
        const parentServices = parentCampaign.services || [];
        const parentMedia = parentCampaign.media || [];

        // For each service, create a child campaign for each selected media
        parentServices.forEach(service => {
            if (parentMedia.length === 0) {
                // If no media selected, create one child with just the service
                childCampaigns.push({
                    customerId,
                    campaignLevel: "child",
                    parentCampaignId: createdParent._id.toString(),
                    campaignName: `${service}: ${parentCampaign.campaignName}`,
                    service: service,
                    media: "", // No media
                    countryCode: parentCampaign.countryCode || "",
                    startDate: parentCampaign.startDate,
                    endDate: parentCampaign.alwaysOn ? null : parentCampaign.endDate,
                    status: "Pending",
                });
            } else {
                // Create one child campaign per media for this service
                parentMedia.forEach(media => {
                    childCampaigns.push({
                        customerId,
                        campaignLevel: "child",
                        parentCampaignId: createdParent._id.toString(),
                        campaignName: `${service} - ${media}: ${parentCampaign.campaignName}`,
                        service: service,
                        media: media,
                        countryCode: parentCampaign.countryCode || "",
                        startDate: parentCampaign.startDate,
                        endDate: parentCampaign.alwaysOn ? null : parentCampaign.endDate,
                        status: "Pending",
                    });
                });
            }
        });

        // Create all child campaigns
        if (childCampaigns.length > 0) {
            await createCampaigns(childCampaigns);
        }
    };

    // Handle child/dwarf campaign creation
    const handleCreateChildCampaign = async (childCampaign) => {
        try {
            console.log("handleCreateChildCampaign called with:", childCampaign);
            // Ensure parentCampaignId is a string
            if (childCampaign.parentCampaignId) {
                childCampaign.parentCampaignId = typeof childCampaign.parentCampaignId === 'string' 
                    ? childCampaign.parentCampaignId 
                    : childCampaign.parentCampaignId.toString();
            }
            // Ensure status is set for child/dwarf campaigns
            if (!childCampaign.status) {
                childCampaign.status = "Pending";
            }
            console.log("Calling createCampaigns with:", [childCampaign]);
            const result = await createCampaigns([childCampaign]);
            console.log("createCampaigns result:", result);
            await fetchCampaigns(); // Refresh the campaigns list
        } catch (error) {
            console.error("Error creating child campaign:", error);
            throw error; // Re-throw so modal can show error
        }
    };

    // Get campaigns for current user (My Campaigns)
    const getMyCampaigns = () => {
        if (!user?._id) return [];
        return campaigns.filter(c => 
            c.assignedUsers && c.assignedUsers.includes(user._id)
        );
    };

    // Filter campaigns based on dwarf toggle
    const getFilteredCampaigns = () => {
        if (showDwarfCampaigns) return campaigns;
        return campaigns.filter(c => c.campaignLevel !== "dwarf");
    };

    // Get child campaigns for a parent
    const getChildCampaignsForParent = (parentId) => {
        return campaigns.filter(c => 
            (c.campaignLevel === "child" || (!c.campaignLevel && c.parentCampaignId)) &&
            (c.parentCampaignId === parentId || c.parentCampaignId?.toString() === parentId?.toString())
        );
    };

    return (
        <div className="w-full">
            <DashboardHeading
                title="Campaign Planner"
                label="Plan, create, and manage your campaigns"
                right={
                    <span onClick={() => setShowCreateParent(true)}>
                        <FormButton buttonSize="small">
                            + Create Parent Campaign
                        </FormButton>
                    </span>
                }
                showAnalyzeWithAi={false}
            />

            <div className="flex justify-between items-center mb-4">
                <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden">
                    {viewOptions.map((opt) => (
                        <button
                            key={opt.value}
                            className={`px-4 border-r border-gray-50 py-1 text-sm font-medium focus:outline-none transition-colors duration-150 text-gray-500 ${view === opt.value ? 'bg-[var(--color-primary-searchmind)] text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => setView(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {(view === "calendar" || view === "gantt") && (
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={showDwarfCampaigns}
                            onChange={(e) => setShowDwarfCampaigns(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        Show Dwarf Campaigns
                    </label>
                )}
            </div>

            {view === "parents" && (
                <ParentCampaignsList
                    campaigns={campaigns}
                    onViewDetails={(campaign) => {
                        // Check if it's a parent campaign
                        if (campaign.campaignLevel === "parent" || (!campaign.campaignLevel && !campaign.parentCampaignId && campaign.services)) {
                            setViewParentCampaign(campaign);
                        } else {
                            setViewCampaign(campaign);
                        }
                    }}
                    onCreateChild={(childData) => {
                        if (typeof childData === 'string') {
                            // Legacy support - just parentCampaignId string
                            setShowCreateChild({ parentCampaignId: childData, isDwarf: false });
                        } else {
                            // New format - object with parentCampaignId and isDwarf
                            setShowCreateChild(childData);
                        }
                    }}
                    customerId={customerId}
                />
            )}
            {view === "kanban" && (
                <div className="space-y-6">
                    {/* All Campaigns Kanban */}
                    <div>
                        <CampaignsKanban
                            customerId={customerId}
                            campaigns={getFilteredCampaigns()}
                            onStatusChange={handleStatusChange}
                            onViewDetails={setViewCampaign}
                        />
                    </div>
                </div>
            )}
            {view === "calendar" && (
                <CampaignsCalendar
                    campaigns={getFilteredCampaigns()}
                    onViewDetails={setViewCampaign}
                />
            )}
            {view === "gantt" && (
                <CampaignsGantt
                    campaigns={getFilteredCampaigns()}
                    onViewDetails={setViewCampaign}
                />
            )}
            
            {/* Modals */}
            <CreateParentCampaignModal
                open={showCreateParent}
                onClose={() => setShowCreateParent(false)}
                onCreate={handleCreateParentCampaign}
                customerId={customerId}
            />
            {showCreateChild && (
                <CreateChildCampaignModal
                    open={!!showCreateChild}
                    onClose={() => setShowCreateChild(null)}
                    onCreate={handleCreateChildCampaign}
                    parentCampaignId={typeof showCreateChild === 'string' ? showCreateChild : showCreateChild.parentCampaignId}
                    customerId={customerId}
                    isDwarf={typeof showCreateChild === 'object' ? showCreateChild.isDwarf : false}
                />
            )}
            {viewParentCampaign && (
                <ViewParentCampaignModal
                    open={!!viewParentCampaign}
                    onClose={() => setViewParentCampaign(null)}
                    campaign={viewParentCampaign}
                    childCampaigns={getChildCampaignsForParent(viewParentCampaign._id || viewParentCampaign.id)}
                />
            )}
            <ViewCampaignModal
                open={!!viewCampaign}
                onClose={() => setViewCampaign(null)}
                campaign={viewCampaign}
                campaigns={campaigns}
                customerId={customerId}
                onUpdate={updateCampaign}
                onRefresh={fetchCampaigns}
                onCreateCampaign={handleCreateChildCampaign}
                onDelete={deleteCampaign}
            />
        </div>
    );
}