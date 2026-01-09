import React from "react";
import FormLabel from "@/components/form/FormLabel";
import { FiX } from "react-icons/fi";

export default function ViewCampaignModal({ open, onClose, campaign }) {
	if (!open || !campaign) return null;

	const fields = [
		{ label: "Service", value: campaign.service, span: 1, bold: true },
		{ label: "Media", value: campaign.media, span: 1 },
		{ label: "Campaign Format", value: campaign.campaignFormat, span: 1 },
		{ label: "Country Code", value: campaign.countryCode, span: 1 },
		{ label: "Start Date", value: campaign.startDate ? new Date(campaign.startDate).toLocaleDateString("da-DK") : "-", span: 1 },
		{ label: "End Date", value: campaign.endDate ? new Date(campaign.endDate).toLocaleDateString("da-DK") : "-", span: 1 },
		{ label: "Campaign Name", value: campaign.campaignName, span: 2, bold: true },
		{ label: "Message Brief", value: campaign.messageBrief || "-", span: 2 },
		{ label: "B2B or B2C", value: campaign.b2bOrB2c, span: 1 },
		{ label: "Budget (DKK)", value: typeof campaign.budget === "number" ? campaign.budget.toLocaleString("da-DK") : "-", span: 1 },
		{ label: "Landing Page", value: campaign.landingpage || "-", span: 2 },
		{ label: "Material From Customer", value: campaign.materialFromCustomer || "-", span: 2 },
		{ label: "Campaign Type", value: campaign.campaignType, span: 1 },
		{ label: "Status", value: campaign.status, span: 1, badge: true },
		{ label: "Campaign Dimensions", value: campaign.campaignDimensions || "-", span: 1 },
		{ label: "Campaign Variation", value: campaign.campaignVariation || "-", span: 1 },
		{ label: "Text To Creative", value: campaign.campaignTextToCreative || "-", span: 1 },
		{ label: "Text To Creative Translation", value: campaign.campaignTextToCreativeTranslation || "-", span: 1 },
		{ label: "Comment To Customer", value: campaign.commentToCustomer || "-", span: 2 },
		{ label: "Ready For Approval", value: campaign.readyForApproval ? "Yes" : "No", span: 1 },
		{ label: "Created At", value: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("da-DK") : "-", span: 1 },
	];

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

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
			<div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] relative overflow-hidden flex flex-col">
				{/* Header */}
				<div className="bg-[var(--color-primary-searchmind)] text-white px-8 py-6 flex items-center justify-between">
					<div>
						<p className="text-sm text-white/80">Campaign Details</p>
						<h2 className="text-2xl font-bold mb-1">{campaign.campaignName}</h2>
					</div>
					<button
						className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
						onClick={onClose}
						aria-label="Close"
					>
						<FiX size={24} />
					</button>
				</div>

				{/* Content */}
				<div className="overflow-y-auto flex-1 p-8">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{fields.map((field, idx) => (
							<div key={idx} className={field.span === 2 ? "md:col-span-2" : ""}>
								<FormLabel htmlFor={`field-${idx}`}>{field.label}</FormLabel>
								<div
									id={`field-${idx}`}
									className={`mt-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm ${field.bold ? "font-semibold text-gray-900" : "text-gray-700"} ${field.badge && field.value !== "-" ? "inline-block px-3 py-1 rounded-full text-xs font-medium " + getStatusColor(field.value) : ""}`}
									style={{ wordBreak: "break-word" }}
								>
									{field.value}
								</div>
							</div>
						))}
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
