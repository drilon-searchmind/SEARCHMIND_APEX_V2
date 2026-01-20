import React, { useState, useEffect } from "react";
import { FiX, FiInfo, FiCalendar, FiDollarSign, FiTag, FiCheckCircle, FiAlertCircle } from "react-icons/fi";

export default function ViewCampaignModal({ open, onClose, campaign }) {
	const [users, setUsers] = useState([]);
	const [loadingUsers, setLoadingUsers] = useState(false);

	useEffect(() => {
		const fetchUsers = async () => {
			setLoadingUsers(true);
			try {
				const response = await fetch('/api/users');
				const userData = await response.json();
				setUsers(userData.filter(user => !user.isArchived));
			} catch (error) {
				console.error('Error fetching users:', error);
			} finally {
				setLoadingUsers(false);
			}
		};

		if (open) {
			fetchUsers();
		}
	}, [open]);

	if (!open || !campaign) return null;

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
		<div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
			<div className="bg-white rounded-xl shadow-2xl w-[80vw] max-h-[90vh] relative overflow-hidden flex flex-col">
				{/* Header */}
				<div className="bg-[var(--color-primary-searchmind)] text-white px-8 py-6 flex items-center justify-between">
					<div className="flex-1">
						<h2 className="text-2xl font-bold mb-1">Campaign Details</h2>
						<p className="text-sm text-white/80">{campaign.campaignName}</p>
					</div>
					<div className="flex items-center gap-3">
						<span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(campaign.status)} flex items-center`}>
							{getStatusIcon(campaign.status)}
							{campaign.status}
						</span>
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
								<p className="text-sm font-semibold text-gray-900">{campaign.service}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Media</p>
								<p className="text-sm text-gray-700">{campaign.media}</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Campaign Format</p>
								<p className="text-sm text-gray-700">{campaign.campaignFormat}</p>
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
									) : campaign.assignedUsers && campaign.assignedUsers.length > 0 ? (
										campaign.assignedUsers.map((userId) => {
											const user = users.find(u => u._id === userId);
											const isInternal = !user?.isExternal;
											if (!isInternal) return null; // Skip external users

											return (
												<div
													key={userId}
													className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1"
												>
													<div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
														{user?.image ? (
															<img
																src={user.image}
																alt={user.name}
																className="w-6 h-6 rounded-full object-cover"
															/>
														) : (
															<span className="text-xs font-medium text-gray-600">
																{user?.name.charAt(0).toUpperCase() || '?'}
															</span>
														)}
													</div>
													<span className="text-sm text-gray-700">
														{user?.name || `User ${userId.slice(-4)}`}
													</span>
												</div>
											);
										})
									) : (
										<span className="text-sm text-gray-500">No assigned users</span>
									)}
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
								<p className="text-xl font-bold text-gray-900">
									{typeof campaign.budget === "number" ? `${campaign.budget.toLocaleString("da-DK")} DKK` : "-"}
								</p>
							</div>

							<div>
								<p className="text-xs font-medium text-gray-500 mb-1">Landing Page</p>
								<p className="text-sm text-gray-700 break-all">{campaign.landingpage || "-"}</p>
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

				{/* Footer */}
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
