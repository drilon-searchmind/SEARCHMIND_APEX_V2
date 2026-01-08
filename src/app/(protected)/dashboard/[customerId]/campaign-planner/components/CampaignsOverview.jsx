import React, { useState } from "react";


const TABS = [
	{ label: "Paid Social", value: "Paid Social" },
	{ label: "Paid Search", value: "Paid Search" },
	{ label: "Email Marketing", value: "Email Marketing" },
	{ label: "SEO", value: "SEO" },
];

const STATUS_COLORS = {
	Pending: "bg-yellow-100 text-yellow-800",
	"Pending Customer Approval": "bg-orange-100 text-orange-800",
	Approved: "bg-blue-100 text-blue-800",
	Live: "bg-green-100 text-green-800",
	Ended: "bg-gray-100 text-gray-800",
};


export default function CampaignsOverview({ customerId, campaigns = [] }) {
	const [activeTab, setActiveTab] = useState(TABS[0].value);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");

	const filteredCampaigns = campaigns.filter(
		(c) =>
			c.customerId === customerId &&
			c.service === activeTab &&
			(!search || c.campaignName.toLowerCase().includes(search.toLowerCase())) &&
			(!statusFilter || c.status === statusFilter)
	);

	const uniqueStatuses = Array.from(new Set(campaigns.map((c) => c.status)));

	return (
		<div className="w-full">
			{/* Tabs */}
			<div className="flex gap-2 mb-4">
				{TABS.map((tab) => (
					<button
						key={tab.value}
						className={`px-4 py-2 rounded-lg font-medium transition-colors duration-150 border border-gray-200 ${activeTab === tab.value
							? "bg-white text-[var(--color-primary-searchmind)] shadow-sm"
							: "bg-gray-50 text-gray-500 hover:text-[var(--color-primary-searchmind)]"
							}`}
						onClick={() => setActiveTab(tab.value)}
					>
						{tab.label}
					</button>
				))}
			</div>
			{/* Filters */}
			<div className="flex flex-wrap gap-2 mb-4 items-center">
				<input
					type="text"
					placeholder="Search campaign name..."
					className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-searchmind)]"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<select
					className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
				>
					<option value="">All Statuses</option>
					{uniqueStatuses.map((status) => (
						<option key={status} value={status}>
							{status}
						</option>
					))}
				</select>
			</div>
			{/* Campaigns List */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredCampaigns.length === 0 && (
					<div className="col-span-full text-center text-gray-400 py-8">No campaigns found.</div>
				)}
				{filteredCampaigns.map((c) => (
					<div
						key={c.id}
						className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow duration-150"
					>
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
								{c.media}
							</span>
							<span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-800"}`}>{c.status}</span>
						</div>
						<div className="font-bold text-lg text-gray-900 mb-1">{c.campaignName}</div>
						<div className="text-sm text-gray-500 mb-1">{c.messageBrief}</div>
						<div className="flex flex-wrap gap-2 text-xs text-gray-400">
							<span>{c.campaignFormat}</span>
							<span>{c.countryCode}</span>
							<span>{c.b2bOrB2c}</span>
							<span>Budget: {c.budget.toLocaleString()} DKK</span>
							{c.readyForApproval && <span className="text-green-500 font-semibold">Ready for Approval</span>}
						</div>
						<div className="flex justify-between items-end mt-2">
							<span className="text-xs text-gray-300">Created: {c.createdAt}</span>
							{/* Placeholder for actions */}
							<button className="text-xs text-[var(--color-primary-searchmind)] font-semibold hover:underline">View details 2</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
