import React, { useState, useEffect } from "react";
import FormButton from "@/components/form/FormButton";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";
import { FiX } from "react-icons/fi";

const SERVICES = ["Paid Social", "Paid Search", "Email Marketing", "SEO"];

// Media mapping based on service
const SERVICE_MEDIA_MAP = {
    "Paid Social": ["META", "LinkedIn", "Pinterest", "TikTok", "YouTube"],
    "Paid Search": ["Google"],
    "Email Marketing": ["Email"],
    "SEO": ["Website"]
};

// Mapping ClickUp service IDs to campaign service names
const CLICKUP_TO_CAMPAIGN_SERVICES = {
    "51ed563e-4a2c-489b-9506-be385c49a354": "SEO", // SEO
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "Paid Search", // PPC
    "2df85265-d5eb-4e86-a111-5d55623851fa": "Paid Social", // PS
    "55b3e92d-5972-4246-8160-73d7ba04401a": "Email Marketing", // EM
};

export default function CreateParentCampaignModal({ open, onClose, onCreate, customerId }) {
    const [form, setForm] = useState({
        campaignName: "",
        services: [],
        responsible: "searchmind",
        media: [],
        countryCode: "",
        startDate: "",
        endDate: "",
        alwaysOn: false,
        totalBudget: "",
        comment: "",
        messageBrief: "",
        assignedUsers: []
    });

    const [availableMedia, setAvailableMedia] = useState([]);
    const [clickupUsers, setClickupUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [budgetAllocations, setBudgetAllocations] = useState({}); // {childKey: budget}

    // Fetch ClickUp users on modal open
    useEffect(() => {
        const fetchClickupUsers = async () => {
            if (!open || !customerId) return;
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

        if (open) {
            fetchClickupUsers();
        }
    }, [open, customerId]);

    // Update available media and auto-assign users when services change
    useEffect(() => {
        if (form.services.length > 0) {
            const mediaSet = new Set();
            form.services.forEach(service => {
                const mediaForService = SERVICE_MEDIA_MAP[service] || [];
                mediaForService.forEach(m => mediaSet.add(m));
            });
            setAvailableMedia(Array.from(mediaSet));

            // Remove media that are no longer available
            setForm(prev => ({
                ...prev,
                media: prev.media.filter(m => mediaSet.has(m))
            }));

            // Auto-assign users based on selected services
            const relevantUsers = clickupUsers.filter(user => {
                const campaignService = CLICKUP_TO_CAMPAIGN_SERVICES[user.service];
                return campaignService && form.services.includes(campaignService);
            });

            // Extract unique user IDs
            const userIds = [...new Set(relevantUsers.map(user => user.id))];

            setForm(prev => ({
                ...prev,
                assignedUsers: userIds
            }));
        } else {
            setAvailableMedia([]);
            setForm(prev => ({ ...prev, media: [], assignedUsers: [] }));
        }
    }, [form.services, clickupUsers]);

    // Calculate child campaigns that will be created
    const getChildCampaigns = () => {
        const childCampaigns = [];
        const parentServices = form.services || [];
        const parentMedia = form.media || [];

        // For each service, create a child campaign only for media that are valid for that service
        parentServices.forEach(service => {
            // Get valid media for this service
            const validMediaForService = SERVICE_MEDIA_MAP[service] || [];

            // Filter selected media to only include those valid for this service
            const validSelectedMedia = parentMedia.filter(media => validMediaForService.includes(media));

            if (validSelectedMedia.length === 0) {
                // If no valid media selected for this service, create one child with just the service
                childCampaigns.push({
                    key: `${service}`,
                    campaignName: `${service}: ${form.campaignName}`,
                    service: service,
                    media: ""
                });
            } else {
                // Create one child campaign per valid media for this service
                validSelectedMedia.forEach(media => {
                    childCampaigns.push({
                        key: `${service}-${media}`,
                        campaignName: `${service} - ${media}: ${form.campaignName}`,
                        service: service,
                        media: media
                    });
                });
            }
        });

        return childCampaigns;
    };

    // Update budget allocations when total budget or child campaigns change
    useEffect(() => {
        const childCampaigns = getChildCampaigns();
        const totalBudget = parseFloat(form.totalBudget) || 0;

        if (childCampaigns.length > 0 && totalBudget > 0) {
            // Check if we already have allocations for all current child campaigns
            const hasAllAllocations = childCampaigns.every(child => budgetAllocations[child.key] !== undefined);

            if (!hasAllAllocations) {
                // Distribute budget equally among child campaigns
                const equalBudget = Math.floor(totalBudget / childCampaigns.length);
                const remainder = totalBudget % childCampaigns.length;

                const newAllocations = {};
                childCampaigns.forEach((child, index) => {
                    // Give the remainder to the first few campaigns
                    newAllocations[child.key] = equalBudget + (index < remainder ? 1 : 0);
                });

                setBudgetAllocations(newAllocations);
            }
        } else {
            // Reset allocations if no budget or no child campaigns
            setBudgetAllocations({});
        }
    }, [form.totalBudget, form.services, form.media]);

    const handleBudgetAllocationChange = (childKey, newBudget) => {
        const childCampaigns = getChildCampaigns();
        const totalBudget = parseFloat(form.totalBudget) || 0;

        // Ensure the new budget is not negative
        const validBudget = Math.max(0, parseFloat(newBudget) || 0);

        setBudgetAllocations(prev => {
            const newAllocations = { ...prev, [childKey]: validBudget };

            // Calculate total allocated
            const totalAllocated = Object.values(newAllocations).reduce((sum, budget) => sum + budget, 0);

            // If we exceed total budget, scale down other allocations proportionally
            if (totalAllocated > totalBudget) {
                const excess = totalAllocated - totalBudget;
                const otherKeys = Object.keys(newAllocations).filter(key => key !== childKey);
                const totalOthers = otherKeys.reduce((sum, key) => sum + newAllocations[key], 0);

                if (totalOthers > 0) {
                    const scaleFactor = (totalOthers - excess) / totalOthers;
                    otherKeys.forEach(key => {
                        newAllocations[key] = Math.max(0, Math.floor(newAllocations[key] * scaleFactor));
                    });
                }
            }

            return newAllocations;
        });
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (name === "services") {
            const options = Array.from(e.target.selectedOptions).map((o) => o.value);
            setForm((prev) => ({ ...prev, services: options }));
        } else if (name === "media") {
            const options = Array.from(e.target.selectedOptions).map((o) => o.value);
            setForm((prev) => ({ ...prev, media: options }));
        } else if (name === "alwaysOn") {
            setForm((prev) => ({
                ...prev,
                alwaysOn: checked,
                endDate: checked ? "" : prev.endDate // Clear endDate if alwaysOn is checked
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                [name]: type === "checkbox" ? checked : value,
            }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.campaignName || form.services.length === 0) return;
        
        const parentCampaign = {
            customerId,
            campaignLevel: "parent",
            campaignName: form.campaignName,
            services: form.services,
            responsible: form.responsible,
            media: form.media,
            countryCode: form.countryCode,
            startDate: form.startDate ? new Date(form.startDate) : null,
            endDate: form.alwaysOn ? null : (form.endDate ? new Date(form.endDate) : null),
            alwaysOn: form.alwaysOn,
            totalBudget: form.totalBudget ? Number(form.totalBudget) : null,
            comment: form.comment,
            budgetAllocations: budgetAllocations, // Include budget allocations
            // No status for parent campaigns
        };
        
        // Auto-create child campaigns for each service+media combination
        // We'll create the parent first, then create children
        // For now, pass parent campaign and let the page handle child creation
        onCreate(parentCampaign);
        onClose();
        // Reset form
        setForm({
            campaignName: "",
            services: [],
            responsible: "searchmind",
            media: [],
            countryCode: "",
            startDate: "",
            endDate: "",
            alwaysOn: false,
            totalBudget: "",
            comment: "",
            messageBrief: "",
            assignedUsers: []
        });
        setBudgetAllocations({});
    };

    if (!open) return null;

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
                <h2 className="text-xl font-bold mb-6 text-gray-900">Create Parent Campaign</h2>
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

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="services" required>Services</FormLabel>
                        <div className="mt-2">
                            {/* Selected services display */}
                            {form.services.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {form.services.map(service => (
                                        <span key={service} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                            {service}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        services: prev.services.filter(s => s !== service)
                                                    }));
                                                }}
                                                className="ml-1 text-blue-600 hover:text-blue-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {/* Services dropdown */}
                            <select
                                id="services"
                                name="services"
                                multiple
                                value={form.services}
                                onChange={handleChange}
                                className="h-32 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                                required
                            >
                                {SERVICES.map((s) => (
                                    <option key={s} value={s} disabled={form.services.includes(s)}>
                                        {s} {form.services.includes(s) ? '✓' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                Selected: {form.services.length} services • Hold Ctrl/Cmd to select multiple
                            </p>
                        </div>
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
                            <p className="mt-1 text-xs text-gray-500">Users are automatically assigned based on selected services</p>
                        </div>
                    )}

                    <div>
                        <FormLabel htmlFor="responsible" required>Responsible</FormLabel>
                        <select 
                            id="responsible"
                            name="responsible" 
                            value={form.responsible} 
                            onChange={handleChange} 
                            className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                        >
                            <option value="searchmind">Searchmind</option>
                            <option value="kunde">Internal</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="media">Media</FormLabel>
                        <div className="mt-2">
                            {/* Selected media display */}
                            {form.media.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {form.media.map(media => (
                                        <span key={media} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                            {media}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        media: prev.media.filter(m => m !== media)
                                                    }));
                                                }}
                                                className="ml-1 text-green-600 hover:text-green-800"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {/* Media dropdown */}
                            <select
                                id="media"
                                name="media"
                                multiple
                                value={form.media}
                                onChange={handleChange}
                                disabled={form.services.length === 0}
                                className="h-24 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                {availableMedia.length === 0 ? (
                                    <option disabled>Select services first</option>
                                ) : (
                                    availableMedia.map((m) => (
                                        <option key={m} value={m} disabled={form.media.includes(m)}>
                                            {m} {form.media.includes(m) ? '✓' : ''}
                                        </option>
                                    ))
                                )}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                {availableMedia.length === 0
                                    ? 'Select services first'
                                    : `Selected: ${form.media.length} media • Hold Ctrl/Cmd to select multiple`
                                }
                            </p>
                        </div>
                    </div>

                    <div>
                        <FormLabel htmlFor="startDate">Start Date</FormLabel>
                        <input
                            id="startDate"
                            type="date"
                            name="startDate"
                            value={form.startDate}
                            onChange={handleChange}
                            className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="endDate" disabled={form.alwaysOn}>End Date</FormLabel>
                        <input
                            id="endDate"
                            type="date"
                            name="endDate"
                            value={form.endDate}
                            onChange={handleChange}
                            disabled={form.alwaysOn}
                            className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="countryCode">Country Code</FormLabel>
                        <FormInputText
                            id="countryCode"
                            name="countryCode"
                            value={form.countryCode}
                            onChange={handleChange}
                        />
                    </div>

                    <div>
                        <FormLabel htmlFor="totalBudget">Total Budget (DKK)</FormLabel>
                        <FormInputText
                            id="totalBudget"
                            type="number"
                            name="totalBudget"
                            value={form.totalBudget}
                            onChange={handleChange}
                            min="0"
                        />
                    </div>

                    <div className="md:col-span-2 flex items-center gap-2">
                        <input
                            id="alwaysOn"
                            type="checkbox"
                            name="alwaysOn"
                            checked={form.alwaysOn}
                            onChange={handleChange}
                            className="rounded border-gray-300"
                        />
                        <FormLabel htmlFor="alwaysOn">Always On</FormLabel>
                    </div>

                    {/* Budget Allocation Sliders */}
                    {(() => {
                        const childCampaigns = getChildCampaigns();
                        const totalBudget = parseFloat(form.totalBudget) || 0;
                        const totalAllocated = Object.values(budgetAllocations).reduce((sum, budget) => sum + budget, 0);

                        return childCampaigns.length > 0 && totalBudget > 0 ? (
                            <div className="md:col-span-2">
                                <FormLabel>Budget Allocation per Child Campaign</FormLabel>
                                <div className="mt-2 space-y-4">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Total Budget: {totalBudget.toLocaleString()} DKK</span>
                                        <span>Allocated: {totalAllocated.toLocaleString()} DKK</span>
                                        <span className={totalAllocated > totalBudget ? 'text-red-500' : totalAllocated < totalBudget ? 'text-orange-500' : 'text-green-500'}>
                                            {totalAllocated > totalBudget ? 'Over' : totalAllocated < totalBudget ? 'Under' : 'Exact'}
                                        </span>
                                    </div>

                                    {childCampaigns.map((child) => {
                                        const allocatedBudget = budgetAllocations[child.key] || 0;
                                        const percentage = totalBudget > 0 ? (allocatedBudget / totalBudget) * 100 : 0;

                                        return (
                                            <div key={child.key} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-gray-900">{child.campaignName}</span>
                                                    <span className="text-sm text-gray-600">{allocatedBudget.toLocaleString()} DKK</span>
                                                </div>

                                                <div className="space-y-2">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max={totalBudget}
                                                        step="100"
                                                        value={allocatedBudget}
                                                        onChange={(e) => handleBudgetAllocationChange(child.key, e.target.value)}
                                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span>0 DKK</span>
                                                        <span>{percentage.toFixed(1)}%</span>
                                                        <span>{totalBudget.toLocaleString()} DKK</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <p className="mt-2 text-xs text-gray-500">
                                    Adjust the sliders to allocate budget across child campaigns. Budget will be automatically balanced to stay within total budget.
                                </p>
                            </div>
                        ) : null;
                    })()}

                    <div>
                        <FormLabel htmlFor="messageBrief">Message Brief (Budskab)</FormLabel>
                        <FormInputText
                            id="messageBrief"
                            name="messageBrief"
                            value={form.messageBrief}
                            onChange={handleChange}
                            placeholder="Enter the campaign message brief..."
                        />
                    </div>

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="comment">Comment</FormLabel>
                        <textarea
                            id="comment"
                            name="comment"
                            value={form.comment}
                            onChange={handleChange}
                            rows={4}
                            className="mt-2 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
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
                        <FormButton type="submit">Create Parent Campaign</FormButton>
                    </div>
                </form>
            </div>
        </div>
    );
}
