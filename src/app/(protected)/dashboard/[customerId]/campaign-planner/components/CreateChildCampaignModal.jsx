import React, { useState, useEffect } from "react";
import FormButton from "@/components/form/FormButton";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { FiX } from "react-icons/fi";

const SERVICES = ["Paid Social", "Paid Search", "Email Marketing", "SEO"];
const MEDIA = ["META", "LinkedIn", "Pinterest", "TikTok", "YouTube", "Google", "Email", "Website", "Other"];
const FORMATS = ["Video", "Picture", "Carousel", "Display Ad", "Search Ad", "Newsletter", "Email Flow", "Landingpage", "Collection"];
const STATUS = ["Pending", "Pending Customer Approval", "Approved", "Live", "Ended"];

// Mapping ClickUp service IDs to campaign service names
const CLICKUP_TO_CAMPAIGN_SERVICES = {
    "51ed563e-4a2c-489b-9506-be385c49a354": "SEO", // SEO
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "Paid Search", // PPC
    "2df85265-d5eb-4e86-a111-5d55623851fa": "Paid Social", // PS
    "55b3e92d-5972-4246-8160-73d7ba04401a": "Email Marketing", // EM
};

export default function CreateChildCampaignModal({
    open,
    onClose,
    onCreate,
    parentCampaignId,
    customerId,
    isLineItem = false // If true, creates a line item (child of a child)
}) {
    const [form, setForm] = useState({
        campaignName: "",
        service: SERVICES[0],
        media: MEDIA[0],
        campaignFormat: FORMATS[0],
        countryCode: "",
        startDate: "",
        endDate: "",
        messageBrief: "",
        budget: "",
        landingpage: "",
        materialFromCustomer: "",
        readyForApproval: false,
        status: STATUS[0],
        commentToCustomer: "",
        campaignDimensions: "",
        campaignVariation: "",
        campaignTextToCreative: "",
        campaignTextToCreativeTranslation: "",
        assignedUsers: []
    });

    const [clickupUsers, setClickupUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [parentCampaign, setParentCampaign] = useState(null);
    const [loadingParent, setLoadingParent] = useState(false);

    useEffect(() => {
        const fetchClickupUsers = async () => {
            if (!customerId) return;
            setLoadingUsers(true);
            try {
                const response = await fetch(`/api/clickup-team-members/${customerId}`);
                if (response.ok) {
                    const data = await response.json();
                    setClickupUsers(data.members || []);
                }
            } catch (error) {
                console.error('Error fetching ClickUp users:', error);
            } finally {
                setLoadingUsers(false);
            }
        };

        const fetchParentCampaign = async () => {
            if (!parentCampaignId || !open) return;
            setLoadingParent(true);
            try {
                const parentId = typeof parentCampaignId === 'string' 
                    ? parentCampaignId 
                    : (parentCampaignId?._id || parentCampaignId?.toString() || '');
                
                console.log("Fetching parent campaign data, parentCampaignId:", parentId, "isLineItem:", isLineItem);
                
                // Fetch all campaigns
                const response = await fetch(`/api/campaigns/${customerId}`);
                if (response.ok) {
                    const campaigns = await response.json();
                    
                    let parent = null;
                    
                    if (isLineItem) {
                        // For dwarf campaigns, parentCampaignId is actually a child campaign ID
                        // We need to find the child campaign, then get its parent campaign
                        const childCampaign = campaigns.find(c => 
                            (c._id === parentId || c._id?.toString() === parentId || c.id === parentId) &&
                            (c.campaignLevel === "child" || (!c.campaignLevel && c.parentCampaignId))
                        );
                        
                        if (childCampaign && childCampaign.parentCampaignId) {
                            // Now find the actual parent campaign
                            parent = campaigns.find(c => 
                                (c._id === childCampaign.parentCampaignId || 
                                 c._id?.toString() === childCampaign.parentCampaignId?.toString() ||
                                 c.id === childCampaign.parentCampaignId) &&
                                (c.campaignLevel === "parent" || (!c.campaignLevel && !c.parentCampaignId))
                            );
                            console.log("Line Item: Found child campaign:", childCampaign, "Found parent:", parent);
                        }
                    } else {
                        // For child campaigns, parentCampaignId is the parent campaign ID
                        parent = campaigns.find(c => 
                            (c._id === parentId || c._id?.toString() === parentId || c.id === parentId) &&
                            (c.campaignLevel === "parent" || (!c.campaignLevel && !c.parentCampaignId))
                        );
                        console.log("Child: Found parent campaign:", parent);
                    }
                    
                    if (parent) {
                        setParentCampaign(parent);
                        // Set readonly fields from parent
                        setForm(prev => ({
                            ...prev,
                            countryCode: parent.countryCode || "",
                            startDate: parent.startDate ? new Date(parent.startDate).toISOString().split('T')[0] : "",
                            endDate: parent.alwaysOn ? "" : (parent.endDate ? new Date(parent.endDate).toISOString().split('T')[0] : ""),
                        }));
                    } else {
                        console.error("Parent campaign not found for ID:", parentId);
                    }
                }
            } catch (error) {
                console.error('Error fetching parent campaign:', error);
            } finally {
                setLoadingParent(false);
            }
        };

        if (open) {
            fetchClickupUsers();
            fetchParentCampaign();
        }
    }, [open, parentCampaignId, customerId]);

    // Auto-assign users when service changes
    useEffect(() => {
        if (form.service && clickupUsers.length > 0) {
            // Find users that match the selected service
            const relevantUsers = clickupUsers.filter(user => {
                const campaignService = CLICKUP_TO_CAMPAIGN_SERVICES[user.service];
                return campaignService === form.service;
            });

            // Extract unique user IDs
            const userIds = [...new Set(relevantUsers.map(user => user.id))];

            setForm(prev => ({
                ...prev,
                assignedUsers: userIds
            }));
        }
    }, [form.service, clickupUsers]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("handleSubmit called", { form, parentCampaignId, parentCampaign });
        
        if (!form.campaignName || !form.service) {
            console.log("Validation failed: missing campaignName or service", { campaignName: form.campaignName, service: form.service });
            alert("Please fill in Campaign Name and Service");
            return;
        }
        
        // Validate budget
        if (parentCampaign?.totalBudget && form.budget && Number(form.budget) > parentCampaign.totalBudget) {
            alert(`Budget cannot exceed parent campaign's total budget of ${parentCampaign.totalBudget.toLocaleString('da-DK')} DKK`);
            return;
        }
        
        // Ensure parentCampaignId is a string
        const parentId = typeof parentCampaignId === 'string' ? parentCampaignId : (parentCampaignId?._id || parentCampaignId?.toString() || '');
        
        console.log("Parent ID extracted:", parentId, "from:", parentCampaignId);
        
        if (!parentId) {
            console.error("Parent campaign ID is required", { parentCampaignId, parentId });
            alert("Parent campaign ID is required");
            return;
        }
        
        const childCampaign = {
            customerId,
            parentCampaignId: parentId,
            campaignLevel: isLineItem ? "dwarf" : "child",
            campaignName: form.campaignName,
            service: form.service,
            media: form.media,
            campaignFormat: form.campaignFormat,
            countryCode: form.countryCode,
            startDate: form.startDate ? new Date(form.startDate) : null,
            endDate: form.endDate ? new Date(form.endDate) : null,
            messageBrief: form.messageBrief,
            budget: form.budget ? Number(form.budget) : null,
            landingpage: form.landingpage,
            materialFromCustomer: form.materialFromCustomer,
            readyForApproval: form.readyForApproval,
            status: form.status,
            commentToCustomer: form.commentToCustomer,
            campaignDimensions: form.campaignDimensions,
            campaignVariation: form.campaignVariation,
            campaignTextToCreative: form.campaignTextToCreative,
            campaignTextToCreativeTranslation: form.campaignTextToCreativeTranslation,
            assignedUsers: form.assignedUsers,
        };
        
        console.log("Creating child campaign:", childCampaign);
        console.log("onCreate function:", onCreate);
        console.log("onCreate type:", typeof onCreate);
        
        if (!onCreate || typeof onCreate !== 'function') {
            console.error("onCreate is not a function!", onCreate);
            alert("Error: onCreate callback is not available");
            return;
        }
        
        try {
            console.log("Calling onCreate...");
            const result = await onCreate(childCampaign);
            console.log("onCreate completed successfully, result:", result);
            
            // Only close and reset if successful
            // Reset form (but keep parent-derived fields)
            setForm({
                campaignName: "",
                service: SERVICES[0],
                media: MEDIA[0],
                campaignFormat: FORMATS[0],
                countryCode: parentCampaign?.countryCode || "",
                startDate: parentCampaign?.startDate ? new Date(parentCampaign.startDate).toISOString().split('T')[0] : "",
                endDate: parentCampaign?.alwaysOn ? "" : (parentCampaign?.endDate ? new Date(parentCampaign.endDate).toISOString().split('T')[0] : ""),
                messageBrief: "",
                budget: "",
                landingpage: "",
                materialFromCustomer: "",
                readyForApproval: false,
                status: STATUS[0],
                commentToCustomer: "",
                campaignDimensions: "",
                campaignVariation: "",
                campaignTextToCreative: "",
                campaignTextToCreativeTranslation: "",
                assignedUsers: []
            });
            
            onClose();
        } catch (error) {
            console.error("Error creating child campaign:", error);
            alert(`Failed to create child campaign: ${error.message || 'Unknown error'}`);
            // Don't close modal on error
        }
    };

    if (!open) return null;

    // Validate budget against parent's total budget
    const budgetError = parentCampaign?.totalBudget && form.budget && Number(form.budget) > parentCampaign.totalBudget
        ? `Budget cannot exceed parent campaign's total budget of ${parentCampaign.totalBudget.toLocaleString('da-DK')} DKK`
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
            <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <FiX size={24} />
                </button>
                <h2 className="text-xl font-bold mb-6 text-gray-900">
                    Create {isLineItem ? "Line Item" : "Child"} Campaign
                </h2>
                {loadingParent && (
                    <div className="mb-4 text-sm text-gray-500">Loading parent campaign data...</div>
                )}
                <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
                    <div className="md:col-span-2">
                        <FormLabel htmlFor="campaignName" required>Campaign Name</FormLabel>
                        <FormInputText 
                            id="campaignName" 
                            name="campaignName" 
                            value={form.campaignName} 
                            onChange={handleChange} 
                            required 
                        />
                    </div>

                    {/* For line items, only show: Name, Date, Media, Format, Link to material */}
                    {!isLineItem && (
                        <>
                            <div>
                                <FormLabel htmlFor="service" required>Service</FormLabel>
                                <select 
                                    id="service"
                                    name="service" 
                                    value={form.service} 
                                    onChange={handleChange} 
                                    className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                                    required
                                >
                                    {SERVICES.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    <div>
                        <FormLabel htmlFor="media" required>Media</FormLabel>
                        <select 
                            id="media"
                            name="media" 
                            value={form.media} 
                            onChange={handleChange} 
                            className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                            required
                        >
                            {MEDIA.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <FormLabel htmlFor="campaignFormat" required>Campaign Format</FormLabel>
                        <select 
                            id="campaignFormat"
                            name="campaignFormat" 
                            value={form.campaignFormat} 
                            onChange={handleChange} 
                            className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                            required
                        >
                            {FORMATS.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>

                    {!isLineItem && (
                        <>
                            <div>
                                <FormLabel htmlFor="countryCode" required>Country Code</FormLabel>
                                <FormInputText 
                                    id="countryCode" 
                                    name="countryCode" 
                                    value={form.countryCode} 
                                    readOnly
                                    disabled
                                    className="bg-gray-100 cursor-not-allowed"
                                    required 
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <FormLabel htmlFor="startDate">Start Date</FormLabel>
                        <input 
                            id="startDate"
                            type="date" 
                            name="startDate" 
                            value={form.startDate} 
                            readOnly
                            disabled
                            className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 bg-gray-100 cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="endDate">End Date</FormLabel>
                        <input 
                            id="endDate"
                            type="date" 
                            name="endDate" 
                            value={form.endDate} 
                            readOnly
                            disabled
                            className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 bg-gray-100 cursor-not-allowed"
                        />
                    </div>

                    {!isLineItem && (
                        <>
                            <div>
                                <FormLabel htmlFor="budget" required>
                                    Budget (DKK)
                                    {parentCampaign?.totalBudget && (
                                        <span className="text-xs text-gray-500 ml-2">
                                            (Max: {parentCampaign.totalBudget.toLocaleString('da-DK')} DKK)
                                        </span>
                                    )}
                                </FormLabel>
                                <FormInputText 
                                    id="budget" 
                                    type="number" 
                                    name="budget" 
                                    value={form.budget} 
                                    onChange={handleChange} 
                                    min="0" 
                                    max={parentCampaign?.totalBudget || undefined}
                                    required 
                                />
                                {budgetError && (
                                    <p className="text-xs text-red-600 mt-1">{budgetError}</p>
                                )}
                            </div>

                            <div>
                                <FormLabel htmlFor="status" required>Status</FormLabel>
                                <select 
                                    id="status"
                                    name="status" 
                                    value={form.status} 
                                    onChange={handleChange} 
                                    className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                                    required
                                >
                                    {STATUS.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <FormLabel htmlFor="messageBrief">Message Brief</FormLabel>
                                <FormInputText 
                                    id="messageBrief" 
                                    name="messageBrief" 
                                    value={form.messageBrief} 
                                    onChange={handleChange} 
                                />
                            </div>

                            {/* Assigned Users Display */}
                            {form.assignedUsers.length > 0 && (
                                <div className="md:col-span-2">
                                    <FormLabel>Assigned Team Members</FormLabel>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {form.assignedUsers.map(userId => {
                                            const user = clickupUsers.find(u => u.id === userId);
                                            const serviceInfo = user ? CLICKUP_TO_CAMPAIGN_SERVICES[user.service] : null;
                                            return (
                                                <div key={userId} className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                                        {user?.avatar ? (
                                                            <img
                                                                src={user.avatar}
                                                                alt={user.username}
                                                                className="w-6 h-6 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="text-white text-xs font-medium">
                                                                {user?.username?.charAt(0).toUpperCase() || '?'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="font-medium">{user?.username || `User ${userId.slice(-4)}`}</span>
                                                        {serviceInfo && (
                                                            <span className="text-gray-500 ml-1">({serviceInfo})</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">Users are automatically assigned based on selected service</p>
                                </div>
                            )}

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="materialFromCustomer">Material From Customer</FormLabel>
                        <FormInputText 
                            id="materialFromCustomer" 
                            name="materialFromCustomer" 
                            value={form.materialFromCustomer} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="campaignDimensions">Campaign Dimensions</FormLabel>
                        <FormInputText 
                            id="campaignDimensions" 
                            name="campaignDimensions" 
                            value={form.campaignDimensions} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="campaignVariation">Campaign Variation</FormLabel>
                        <FormInputText 
                            id="campaignVariation" 
                            name="campaignVariation" 
                            value={form.campaignVariation} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="campaignTextToCreative">Text To Creative</FormLabel>
                        <FormInputText 
                            id="campaignTextToCreative" 
                            name="campaignTextToCreative" 
                            value={form.campaignTextToCreative} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="campaignTextToCreativeTranslation">Text To Creative Translation</FormLabel>
                        <FormInputText 
                            id="campaignTextToCreativeTranslation" 
                            name="campaignTextToCreativeTranslation" 
                            value={form.campaignTextToCreativeTranslation} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="commentToCustomer">Comment To Customer</FormLabel>
                        <FormInputText 
                            id="commentToCustomer" 
                            name="commentToCustomer" 
                            value={form.commentToCustomer} 
                            onChange={handleChange} 
                        />
                    </div>

                    <div className="md:col-span-2 flex items-center gap-2">
                        <input 
                            id="readyForApproval"
                            type="checkbox" 
                            name="readyForApproval" 
                            checked={form.readyForApproval} 
                            onChange={handleChange} 
                            className="rounded border-gray-300"
                        />
                        <FormLabel htmlFor="readyForApproval">Ready For Approval</FormLabel>
                    </div>
                </>
            )}

            {/* Link to material - shown for both child and line item */}
            <div className="md:col-span-2">
                <FormLabel htmlFor="landingpage">Link to Material</FormLabel>
                <FormInputText 
                    id="landingpage" 
                    name="landingpage" 
                    value={form.landingpage} 
                    onChange={handleChange} 
                />
            </div>

                    <div className="md:col-span-2 flex justify-end gap-2 mt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-6 py-2 rounded-lg font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            onClick={(e) => {
                                console.log("Submit button clicked");
                                // Let the form handle submission
                            }}
                            className="px-6 py-2 rounded-lg font-semibold bg-[var(--color-primary-searchmind)] text-white hover:bg-[var(--color-primary-searchmind-lighter)] transition"
                        >
                            Create {isLineItem ? "Line Item" : "Child"} Campaign
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
