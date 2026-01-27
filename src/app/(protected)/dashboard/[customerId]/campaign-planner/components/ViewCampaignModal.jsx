import React, { useState, useEffect } from "react";
import { FiX, FiInfo, FiCalendar, FiDollarSign, FiTag, FiCheckCircle, FiAlertCircle, FiEdit2, FiUsers, FiTrash2, FiChevronDown, FiChevronRight } from "react-icons/fi";
import CreateChildCampaignModal from "./CreateChildCampaignModal";

// Mapping ClickUp service IDs to campaign service names
const CLICKUP_TO_CAMPAIGN_SERVICES = {
    "51ed563e-4a2c-489b-9506-be385c49a354": "SEO", // SEO
    "bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "Paid Search", // PPC
    "2df85265-d5eb-4e86-a111-5d55623851fa": "Paid Social", // PS
    "55b3e92d-5972-4246-8160-73d7ba04401a": "Email Marketing", // EM
};

export default function ViewCampaignModal({ open, onClose, campaign, campaigns = [], customerId, onUpdate, onRefresh, onCreateCampaign, onDelete }) {
	const [clickupUsers, setClickupUsers] = useState([]);
	const [loadingUsers, setLoadingUsers] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editForm, setEditForm] = useState({});
	const [showCreateDwarf, setShowCreateDwarf] = useState(false);
	const [dwarfSectionExpanded, setDwarfSectionExpanded] = useState(false);

	// Helper function to get users for a campaign
	const getCampaignUsers = (campaign) => {
		if (campaign.assignedUsers && campaign.assignedUsers.length > 0) {
			return campaign.assignedUsers;
		}
		// Fallback: find users based on service
		return clickupUsers
			.filter(user => {
				const campaignService = CLICKUP_TO_CAMPAIGN_SERVICES[user.service];
				return campaignService === campaign.service;
			})
			.map(user => user.id);
	};

	// Fetch ClickUp users when modal opens
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

		if (open) {
			fetchClickupUsers();
		}
	}, [open, customerId]);

	// Initialize edit form when campaign changes
	useEffect(() => {
		if (!open || !campaign) return;

		// Initialize edit form with campaign data
		setEditForm({
			campaignName: campaign.campaignName || "",
			service: campaign.service || "",
			media: campaign.media || "",
			campaignFormat: campaign.campaignFormat || "",
			budget: campaign.budget || "",
			status: campaign.status || "Pending",
			landingpage: campaign.landingpage || "",
			messageBrief: campaign.messageBrief || "",
			commentToCustomer: campaign.commentToCustomer || "",
			assignedUsers: campaign.assignedUsers || [],
			materialFromCustomer: campaign.materialFromCustomer || "",
			campaignDimensions: campaign.campaignDimensions || "",
			campaignVariation: campaign.campaignVariation || "",
			campaignTextToCreative: campaign.campaignTextToCreative || "",
			campaignTextToCreativeTranslation: campaign.campaignTextToCreativeTranslation || "",
			readyForApproval: campaign.readyForApproval || false,
		});
	}, [open, campaign?._id || campaign?.id]);

	// Compute dwarf campaigns directly from props (no state needed) - using same logic as ParentCampaignsList
	const dwarfCampaigns = React.useMemo(() => {
		if (!campaign || !campaigns || campaigns.length === 0) return [];
		if (campaign.campaignLevel === "child" || (!campaign.campaignLevel && campaign.parentCampaignId)) {
			const childId = campaign._id || campaign.id;
			const childIdStr = String(childId || "");
			
			// Get all dwarf campaigns first
			const allDwarfs = campaigns.filter(c => c.campaignLevel === "dwarf");
			
			// Filter by parentCampaignId - try multiple comparison methods
			const dwarfs = allDwarfs.filter(c => {
				const parentId = c.parentCampaignId;
				const parentIdStr = String(parentId || "");
				
				// Try multiple comparison methods
				const matches = 
					parentId === childId ||
					parentId === childIdStr ||
					parentIdStr === childId ||
					parentIdStr === childIdStr;
				
				return matches;
			});
			
			// Debug logging
			if (dwarfs.length === 0 && allDwarfs.length > 0) {
				console.log("Dwarf campaigns not matching:", {
					childCampaignId: childId,
					childCampaignIdStr: childIdStr,
					totalDwarfs: allDwarfs.length,
					dwarfParentIds: allDwarfs.map(d => ({
						name: d.campaignName,
						parentId: d.parentCampaignId,
						parentIdStr: String(d.parentCampaignId || ""),
						matches: String(d.parentCampaignId || "") === childIdStr
					}))
				});
			}
			
			return dwarfs;
		}
		return [];
	}, [campaign?._id || campaign?.id, campaigns]);

	// Calculate remaining budget for child campaigns
	const remainingBudget = React.useMemo(() => {
		if (!campaign || !campaigns || campaigns.length === 0) return null;
		
		// Only calculate for child campaigns (not parent or dwarf)
		if (campaign.campaignLevel !== "child" && (campaign.campaignLevel || !campaign.parentCampaignId)) {
			return null;
		}

		// Find parent campaign
		const parentId = campaign.parentCampaignId;
		if (!parentId) return null;

		const parentIdStr = String(parentId);
		const parent = campaigns.find(c => {
			const cId = c._id || c.id;
			const cIdStr = String(cId || "");
			return (
				(c.campaignLevel === "parent" || (!c.campaignLevel && !c.parentCampaignId && c.services)) &&
				(cId === parentId || cIdStr === parentIdStr || String(cId) === parentIdStr || String(cIdStr) === parentId)
			);
		});

		if (!parent || !parent.totalBudget) return null;

		// Get all child campaigns for this parent (excluding current campaign)
		const currentCampaignId = campaign._id || campaign.id;
		const currentCampaignIdStr = String(currentCampaignId || "");
		
		const allChildren = campaigns.filter(c => {
			const cParentId = c.parentCampaignId;
			const cParentIdStr = String(cParentId || "");
			const isChild = c.campaignLevel === "child" || (!c.campaignLevel && cParentId);
			const matchesParent = cParentId === parentId || cParentIdStr === parentIdStr || String(cParentId) === parentIdStr || String(cParentIdStr) === parentId;
			const isNotCurrent = (c._id || c.id) !== currentCampaignId && String(c._id || c.id) !== currentCampaignIdStr;
			return isChild && matchesParent && isNotCurrent;
		});

		// Calculate allocated budget (sum of all other child campaigns)
		const allocatedBudget = allChildren.reduce((sum, child) => {
			return sum + (child.budget || 0);
		}, 0);

		// Remaining budget = total budget - allocated budget
		const remaining = parent.totalBudget - allocatedBudget;
		return Math.max(0, remaining); // Can't go below zero
	}, [campaign, campaigns]);

	if (!open || !campaign) return null;

	// Check if this is a parent campaign (should use ViewParentCampaignModal instead)
	if (campaign.campaignLevel === "parent" || (!campaign.campaignLevel && !campaign.parentCampaignId && campaign.services)) {
		// This should be handled by ViewParentCampaignModal, but fallback to show basic info
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
				<div className="bg-white rounded-xl shadow-2xl w-[80vw] max-h-[90vh] relative overflow-hidden flex flex-col">
					<div className="bg-[var(--color-primary-searchmind)] text-white px-8 py-6 flex items-center justify-between">
						<div className="flex-1">
							<h2 className="text-2xl font-bold mb-1">Parent Campaign</h2>
							<p className="text-sm text-white/80">{campaign.campaignName}</p>
						</div>
						<button
							className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
							onClick={onClose}
							aria-label="Close"
						>
							<FiX size={24} />
						</button>
					</div>
					<div className="p-8">
						<p className="text-gray-600">Please use the Parent Campaigns view to see full details.</p>
					</div>
					<div className="border-t border-gray-200 px-8 py-4 bg-gray-50 flex justify-end">
						<button
							onClick={onClose}
							className="px-6 py-2 rounded-lg font-semibold border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	const getStatusColor = (status) => {
		switch (status) {
			case "Live": return "bg-green-100 text-green-800";
			case "Approved": return "bg-blue-100 text-blue-800";
			case "Pending": return "bg-yellow-100 text-yellow-800";
			case "Pending Customer Approval": return "bg-orange-100 text-orange-800";
			case "Ended": return "bg-gray-100 text-gray-800";
			default: return "bg-gray-100 text-gray-800";
		}
	};

	const getStatusIcon = (status) => {
		switch (status) {
			case "Live": return <FiCheckCircle className="inline mr-1" />;
			case "Approved": return <FiCheckCircle className="inline mr-1" />;
			case "Pending": return <FiAlertCircle className="inline mr-1" />;
			case "Pending Customer Approval": return <FiAlertCircle className="inline mr-1" />;
			default: return null;
		}
	};

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
				<div className="bg-white rounded-xl shadow-2xl w-[80vw] max-h-[90vh] relative overflow-hidden flex flex-col">
				{/* Header */}
				<div className="bg-[var(--color-primary-searchmind)] text-white px-8 py-6 flex items-center justify-between">
					<div className="flex-1">
						<h2 className="text-2xl font-bold mb-1">Campaign Details</h2>
						{isEditing ? (
							<input
								type="text"
								value={editForm.campaignName || ""}
								onChange={(e) => setEditForm({...editForm, campaignName: e.target.value})}
								className="mt-1 w-full bg-white/10 border border-white/20 rounded px-3 py-1 text-sm text-white placeholder-white/60"
								placeholder="Campaign Name"
							/>
						) : (
							<p className="text-sm text-white/80">{campaign.campaignName}</p>
						)}
					</div>
					<div className="flex items-center gap-3">
						{isEditing ? (
							<select
								value={editForm.status || "Pending"}
								onChange={(e) => setEditForm({...editForm, status: e.target.value})}
								className="px-4 py-2 rounded-full text-sm font-semibold border bg-white text-black ml-10"
							>
								<option value="Pending">Pending</option>
								<option value="Pending Customer Approval">Pending Customer Approval</option>
								<option value="Approved">Approved</option>
								<option value="Live">Live</option>
								<option value="Ended">Ended</option>
							</select>
						) : (
							<span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(campaign.status)} flex items-center`}>
								{getStatusIcon(campaign.status)}
								{campaign.status}
							</span>
						)}
						<button
							className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
							onClick={onClose}
							aria-label="Close"
						>
							<FiX size={24} />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="overflow-y-auto flex-1 p-8">
					<div className="grid grid-cols-3 gap-8">
						{/* Column 1: Campaign Information */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
								<FiInfo className="text-[var(--color-primary-searchmind)]" size={18} />
								<h3 className="text-base font-semibold text-gray-900">Campaign Information</h3>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Service</p>
								{isEditing ? (
									<select
										value={editForm.service || ""}
										onChange={(e) => setEditForm({...editForm, service: e.target.value})}
										className="mt-1 w-full rounded-lg border px-3 py-2 text-sm border-gray-300"
									>
										<option value="Paid Social">Paid Social</option>
										<option value="Paid Search">Paid Search</option>
										<option value="Email Marketing">Email Marketing</option>
										<option value="SEO">SEO</option>
									</select>
								) : (
									<p className="text-sm font-semibold text-gray-900">{campaign.service}</p>
								)}
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Media</p>
								{isEditing ? (
									<select
										value={editForm.media || ""}
										onChange={(e) => setEditForm({...editForm, media: e.target.value})}
										className="mt-1 w-full rounded-lg border px-3 py-2 text-sm border-gray-300"
									>
										<option value="META">META</option>
										<option value="LinkedIn">LinkedIn</option>
										<option value="Pinterest">Pinterest</option>
										<option value="TikTok">TikTok</option>
										<option value="YouTube">YouTube</option>
										<option value="Google">Google</option>
										<option value="Email">Email</option>
										<option value="Website">Website</option>
										<option value="Other">Other</option>
									</select>
								) : (
									<p className="text-sm text-gray-700">{campaign.media}</p>
								)}
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Campaign Format</p>
								{isEditing ? (
									<select
										value={editForm.campaignFormat || ""}
										onChange={(e) => setEditForm({...editForm, campaignFormat: e.target.value})}
										className="mt-1 w-full rounded-lg border px-3 py-2 text-sm border-gray-300"
									>
										<option value="Video">Video</option>
										<option value="Picture">Picture</option>
										<option value="Carousel">Carousel</option>
										<option value="Display Ad">Display Ad</option>
										<option value="Search Ad">Search Ad</option>
										<option value="Newsletter">Newsletter</option>
										<option value="Email Flow">Email Flow</option>
										<option value="Landingpage">Landingpage</option>
										<option value="Collection">Collection</option>
									</select>
								) : (
									<p className="text-sm text-gray-700">{campaign.campaignFormat}</p>
								)}
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Campaign Type</p>
								<p className="text-sm text-gray-700">{campaign.campaignType}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">B2B or B2C</p>
								<p className="text-sm text-gray-700">{campaign.b2bOrB2c}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Country Code</p>
								<p className="text-sm text-gray-700">{campaign.countryCode}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Message Brief</p>
								<p className="text-sm text-gray-700">{campaign.messageBrief || "-"}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Assigned Users</p>
								<div className="flex flex-wrap gap-2">
									{loadingUsers ? (
										<span className="text-sm text-gray-500">Loading...</span>
									) : (() => {
										const campaignUsers = getCampaignUsers(campaign);
										return campaignUsers.length > 0 ? (
											campaignUsers.map((userId) => {
												const user = clickupUsers.find(u => u.id === userId);

												return (
													<div
														key={userId}
														className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2"
													>
														<div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
															{user?.avatar ? (
																<img
																	src={user.avatar}
																	alt={user.username}
																	className="w-6 h-6 rounded-full object-cover"
																/>
															) : (
																<span className="text-xs font-medium text-white">
																	{user?.username?.charAt(0).toUpperCase() || '?'}
																</span>
															)}
														</div>
														<div className="text-sm">
															<span className="font-medium text-gray-900">{user?.username || `User ${userId.slice(-4)}`}</span>
															{user && (
																<span className="text-gray-500 ml-1">
																	({(() => {
																		// Map ClickUp service ID to campaign service name for display
																		const serviceMap = {
																			"51ed563e-4a2c-489b-9506-be385c49a354": "SEO",
																			"bee4b7c5-c9d0-4808-8a4f-b00ee6df311e": "Paid Search",
																			"2df85265-d5eb-4e86-a111-5d55623851fa": "Paid Social",
																			"55b3e92d-5972-4246-8160-73d7ba04401a": "Email Marketing",
																			"28b06356-6f19-4633-bfa4-416c150a562c": "Client Lead"
																		};
																		return serviceMap[user.service] || user.service;
																	})()})
																</span>
															)}
														</div>
													</div>
												);
											})
										) : (
											<span className="text-sm text-gray-500">No assigned users</span>
										);
									})()}
								</div>
							</div>
						</div>

						{/* Column 2: Timeline & Budget */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
								<FiCalendar className="text-[var(--color-primary-searchmind)]" size={18} />
								<h3 className="text-base font-semibold text-gray-900">Timeline & Budget</h3>
							</div>

							<div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-xs font-medium text-gray-500 mb-1">Start Date</p>
										<p className="text-sm font-semibold text-gray-900">
											{campaign.startDate ? new Date(campaign.startDate).toLocaleDateString("da-DK") : "-"}
										</p>
									</div>
									<div>
										<p className="text-xs font-medium text-gray-500 mb-1">End Date</p>
										<p className="text-sm font-semibold text-gray-900">
											{campaign.endDate ? new Date(campaign.endDate).toLocaleDateString("da-DK") : "-"}
										</p>
									</div>
								</div>
							</div>

							<div className="bg-[var(--color-secondary-searchmind)]/10 rounded-lg p-4 border border-[var(--color-secondary-searchmind)]/30">
								<div className="flex items-center gap-2 mb-2">
									<FiDollarSign className="text-[var(--color-primary-searchmind)]" size={16} />
									<p className="text-xs font-medium text-gray-500">Budget</p>
								</div>
								{isEditing ? (
									<div>
										<input
											type="number"
											value={editForm.budget || ""}
											onChange={(e) => {
												const value = e.target.value === "" ? "" : Number(e.target.value);
												if (remainingBudget !== null && value !== "" && value > remainingBudget) {
													return; // Don't allow values above remaining budget
												}
												setEditForm({...editForm, budget: value});
											}}
											max={remainingBudget !== null ? remainingBudget : undefined}
											className="w-full rounded-lg border px-3 py-2 text-sm border-gray-300"
											placeholder="Budget in DKK"
										/>
										{remainingBudget !== null && (
											<p className={`${remainingBudget > 0 ? 'text-green-500' : 'text-red-500'} text-xs mt-1 font-light`}>
												Remaining budget: {remainingBudget.toLocaleString("da-DK")} DKK
											</p>
										)}
									</div>
								) : (
									<p className="text-xl font-bold text-gray-900">
										{typeof campaign.budget === "number" ? `${campaign.budget.toLocaleString("da-DK")} DKK` : "-"}
									</p>
								)}
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Link to Material</p>
								{isEditing ? (
									<input
										type="text"
										value={editForm.landingpage || ""}
										onChange={(e) => setEditForm({...editForm, landingpage: e.target.value})}
										className="mt-1 w-full rounded-lg border px-3 py-2 text-sm border-gray-300"
										placeholder="Link to material"
									/>
								) : (
									<p className="text-sm text-gray-700 break-all">{campaign.landingpage || "-"}</p>
								)}
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Material From Customer</p>
								<p className="text-sm text-gray-700">{campaign.materialFromCustomer || "-"}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Ready For Approval</p>
								<p className="text-sm font-semibold text-gray-900">{campaign.readyForApproval ? "✓ Yes" : "✗ No"}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Created At</p>
								<p className="text-sm text-gray-700">
									{campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("da-DK") : "-"}
								</p>
							</div>
						</div>

						{/* Column 3: Creative Details */}
						<div className="space-y-4">
							<div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
								<FiTag className="text-[var(--color-primary-searchmind)]" size={18} />
								<h3 className="text-base font-semibold text-gray-900">Creative Details</h3>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Campaign Dimensions</p>
								<p className="text-sm text-gray-700">{campaign.campaignDimensions || "-"}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Campaign Variation</p>
								<p className="text-sm text-gray-700">{campaign.campaignVariation || "-"}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Text To Creative</p>
								<p className="text-sm text-gray-700">{campaign.campaignTextToCreative || "-"}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Text To Creative Translation</p>
								<p className="text-sm text-gray-700">{campaign.campaignTextToCreativeTranslation || "-"}</p>
							</div>

							<div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mt-4">
								<p className="text-xs font-medium text-blue-700 mb-2">Comment To Customer</p>
								<p className="text-sm text-gray-700">{campaign.commentToCustomer || "No comments"}</p>
							</div>
						</div>
					</div>
				</div>

				{/* Dwarf Campaigns Section - Only for child campaigns */}
				{(campaign.campaignLevel === "child" || (!campaign.campaignLevel && campaign.parentCampaignId)) && (
					<div className="border-t border-gray-200 px-8 py-6">
						<div className="flex items-center justify-between mb-4">
							<button
								onClick={() => setDwarfSectionExpanded(!dwarfSectionExpanded)}
								className="flex items-center gap-2 hover:bg-gray-100 rounded px-2 py-1 -ml-2 transition-colors"
							>
								{dwarfSectionExpanded ? (
									<FiChevronDown className="text-gray-400" size={18} />
								) : (
									<FiChevronRight className="text-gray-400" size={18} />
								)}
								<FiUsers className="text-[var(--color-primary-searchmind)]" size={18} />
								<h3 className="text-base font-semibold text-gray-900">
									Dwarf Campaigns ({dwarfCampaigns.length})
								</h3>
							</button>
							<button
								onClick={() => setShowCreateDwarf(true)}
								className="px-3 py-1 text-sm bg-[var(--color-primary-searchmind)] text-white hover:bg-[var(--color-primary-searchmind-lighter)] rounded flex items-center gap-1"
							>
								+ Add Dwarf Campaign
							</button>
						</div>
						{dwarfSectionExpanded && (
							<>
								{dwarfCampaigns.length === 0 ? (
									<div className="text-center py-4 text-gray-500 text-sm">
										No dwarf campaigns created yet.
									</div>
								) : (
									<div className="space-y-2">
										{dwarfCampaigns.map((dwarf) => (
											<div key={dwarf._id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<h4 className="font-medium text-gray-900 text-sm mb-1">{dwarf.campaignName}</h4>
														<div className="flex items-center gap-4 text-xs text-gray-600">
															<span>Media: {dwarf.media || "N/A"}</span>
															<span>Format: {dwarf.campaignFormat || "N/A"}</span>
															<span>Link: {dwarf.landingpage ? (
																<a href={dwarf.landingpage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
																	{dwarf.landingpage}
																</a>
															) : "N/A"}</span>
														</div>
													</div>
													<button
														onClick={async () => {
															if (window.confirm(`Are you sure you want to delete "${dwarf.campaignName}"?`)) {
																try {
																	if (onDelete) {
																		await onDelete(dwarf._id || dwarf.id);
																		if (onRefresh) await onRefresh();
																	}
																} catch (error) {
																	console.error("Error deleting dwarf campaign:", error);
																	alert("Failed to delete dwarf campaign");
																}
															}
														}}
														className="px-2 py-1 text-xs text-red-600 hover:text-red-900 hover:bg-red-50 rounded flex items-center gap-1"
													>
														<FiTrash2 size={12} />
														Delete
													</button>
												</div>
											</div>
										))}
									</div>
								)}
							</>
						)}
					</div>
				)}

				{/* Footer */}
				<div className="border-t border-gray-200 px-8 py-4 bg-gray-50 flex justify-between items-center">
					<button
						onClick={() => setIsEditing(!isEditing)}
						className="px-4 py-2 rounded-lg font-semibold border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
					>
						<FiEdit2 size={16} />
						{isEditing ? "Cancel Edit" : "Edit Campaign"}
					</button>
					<div className="flex gap-2">
						{isEditing && (
							<button
								onClick={async () => {
									try {
										await onUpdate(campaign._id || campaign.id, editForm);
										if (onRefresh) await onRefresh();
										setIsEditing(false);
									} catch (error) {
										console.error("Error updating campaign:", error);
										alert("Failed to update campaign");
									}
								}}
								className="px-6 py-2 rounded-lg font-semibold bg-[var(--color-primary-searchmind)] text-white hover:bg-[var(--color-primary-searchmind-lighter)] transition-colors"
							>
								Save Changes
							</button>
						)}
						<button
							onClick={onClose}
							className="px-6 py-2 rounded-lg font-semibold border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
		
		{/* Create Dwarf Campaign Modal */}
		{showCreateDwarf && campaign && (
			<CreateChildCampaignModal
				open={showCreateDwarf}
				onClose={() => setShowCreateDwarf(false)}
				onCreate={async (dwarfCampaign) => {
					if (onCreateCampaign) {
						await onCreateCampaign(dwarfCampaign);
						if (onRefresh) await onRefresh();
						setShowCreateDwarf(false);
					}
				}}
				parentCampaignId={campaign._id || campaign.id}
				customerId={customerId}
				isDwarf={true}
			/>
		)}
		</>
	);
}
