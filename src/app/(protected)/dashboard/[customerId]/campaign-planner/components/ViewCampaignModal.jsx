import React from "react";

export default function ViewCampaignModal({ open, onClose, campaign }) {
  if (!open || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-[80vw] max-h-[80vh] relative overflow-y-auto">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-4 text-gray-900">Campaign Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Service</label>
            <div className="text-base text-gray-900 font-semibold">{campaign.service}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Media</label>
            <div className="text-base text-gray-900">{campaign.media}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Campaign Format</label>
            <div className="text-base text-gray-900">{campaign.campaignFormat}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Country Code</label>
            <div className="text-base text-gray-900">{campaign.countryCode}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Start Date</label>
            <div className="text-base text-gray-900">{campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : "-"}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">End Date</label>
            <div className="text-base text-gray-900">{campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "-"}</div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500">Campaign Name</label>
            <div className="text-base text-gray-900 font-bold">{campaign.campaignName}</div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500">Message Brief</label>
            <div className="text-base text-gray-900">{campaign.messageBrief}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">B2B or B2C</label>
            <div className="text-base text-gray-900">{campaign.b2bOrB2c}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Budget (DKK)</label>
            <div className="text-base text-gray-900">{typeof campaign.budget === "number" ? campaign.budget.toLocaleString() : "-"}</div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500">Landingpage</label>
            <div className="text-base text-gray-900 break-all">{campaign.landingpage}</div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500">Material From Customer</label>
            <div className="text-base text-gray-900">{campaign.materialFromCustomer}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Ready For Approval</label>
            <div className="text-base text-gray-900">{campaign.readyForApproval ? "Yes" : "No"}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Status</label>
            <div className="text-base text-gray-900">{campaign.status}</div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-gray-500">Comment To Customer</label>
            <div className="text-base text-gray-900">{campaign.commentToCustomer}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Campaign Type</label>
            <div className="text-base text-gray-900">{campaign.campaignType}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Campaign Dimensions</label>
            <div className="text-base text-gray-900">{campaign.campaignDimensions}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Campaign Variation</label>
            <div className="text-base text-gray-900">{campaign.campaignVariation}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Text To Creative</label>
            <div className="text-base text-gray-900">{campaign.campaignTextToCreative}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Text To Creative Translation</label>
            <div className="text-base text-gray-900">{campaign.campaignTextToCreativeTranslation}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Created At</label>
            <div className="text-base text-gray-900">{campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
