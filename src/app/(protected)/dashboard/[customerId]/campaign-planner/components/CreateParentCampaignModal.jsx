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
        assignedUsers: []
    });

    const [availableMedia, setAvailableMedia] = useState([]);
    const [clickupUsers, setClickupUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

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
            assignedUsers: []
        });
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
                        <select 
                            id="services"
                            name="services" 
                            multiple 
                            value={form.services} 
                            onChange={handleChange} 
                            className="mt-2 h-24 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
                            required
                        >
                            {SERVICES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple</p>
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
                            <option value="kunde">Kunde</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <FormLabel htmlFor="media">Media</FormLabel>
                        <select 
                            id="media"
                            name="media" 
                            multiple 
                            value={form.media} 
                            onChange={handleChange} 
                            disabled={form.services.length === 0}
                            className="mt-2 h-24 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            {availableMedia.length === 0 ? (
                                <option disabled>Select services first</option>
                            ) : (
                                availableMedia.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))
                            )}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple</p>
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
