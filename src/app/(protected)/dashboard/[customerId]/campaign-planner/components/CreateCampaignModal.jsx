import React, { useState } from "react";

const SERVICES = ["Paid Social", "Paid Search", "Email Marketing", "SEO"];
const MEDIA = ["META", "LinkedIn", "Pinterest", "TikTok", "YouTube", "Google", "Email", "Website", "Other"];
const FORMATS = ["Video", "Picture", "Carousel", "Display Ad", "Search Ad", "Newsletter", "Email Flow", "Landingpage", "Collection"];
const B2B_B2C = ["B2B", "B2C"];
const CAMPAIGN_TYPES = ["Always On", "Conversion"];
const STATUS = ["Pending", "Pending Customer Approval", "Approved", "Live", "Ended"];

export default function CreateCampaignModal({ open, onClose, onCreate }) {
	const [form, setForm] = useState({
		services: [SERVICES[0]],
		media: MEDIA[0],
		campaignFormat: FORMATS[0],
		countryCode: "",
		startDate: "",
		endDate: "",
		campaignName: "",
		messageBrief: "",
		b2bOrB2c: B2B_B2C[0],
		budget: "",
		landingpage: "",
		materialFromCustomer: "",
		readyForApproval: false,
		status: STATUS[0],
		commentToCustomer: "",
		campaignType: CAMPAIGN_TYPES[0],
		campaignDimensions: "",
		campaignVariation: "",
		campaignTextToCreative: "",
		campaignTextToCreativeTranslation: ""
	});

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		if (name === "services") {
			const options = Array.from(e.target.selectedOptions).map((o) => o.value);
			setForm((prev) => ({ ...prev, services: options }));
		} else {
			setForm((prev) => ({
				...prev,
				[name]: type === "checkbox" ? checked : value,
			}));
		}
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		// Only create if campaignName is filled and at least one service is selected
		if (!form.campaignName || !form.services || form.services.length === 0) return;
		const parentId = "parent-" + Date.now();
		const children = form.services.map((service, idx) => ({
			...form,
			service,
			campaignName: `${service}: ${form.campaignName}`,
			id: parentId + "-" + idx,
			parentCampaignId: parentId,
		}));
		// Parent campaign (relationship only)
		const parent = {
			id: parentId,
			customerId: form.customerId,
			campaignName: form.campaignName,
			services: form.services,
			createdAt: new Date().toISOString().slice(0, 10),
			parent: true,
		};
		onCreate([parent, ...children]);
		onClose();
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
			<div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
				<button
					className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
					onClick={onClose}
					aria-label="Close"
				>
					×
				</button>
				<h2 className="text-xl font-bold mb-4 text-gray-900">Create New Campaign</h2>
				<form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
					<div className="md:col-span-2">
						<label className="text-xs font-medium text-gray-500">Services</label>
						<select name="services" multiple value={form.services} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
							{SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Media</label>
						<select name="media" value={form.media} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
							{MEDIA.map((m) => <option key={m} value={m}>{m}</option>)}
						</select>
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Campaign Format</label>
						<select name="campaignFormat" value={form.campaignFormat} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
							{FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
						</select>
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Country Code</label>
						<input name="countryCode" value={form.countryCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" required />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Start Date</label>
						<input type="date" name="startDate" value={form.startDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">End Date</label>
						<input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-medium text-gray-500">Campaign Name</label>
						<input name="campaignName" value={form.campaignName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" required />
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-medium text-gray-500">Message Brief</label>
						<input name="messageBrief" value={form.messageBrief} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">B2B or B2C</label>
						<select name="b2bOrB2c" value={form.b2bOrB2c} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
							{B2B_B2C.map((b) => <option key={b} value={b}>{b}</option>)}
						</select>
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Budget (DKK)</label>
						<input type="number" name="budget" value={form.budget} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" min="0" required />
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-medium text-gray-500">Landingpage</label>
						<input name="landingpage" value={form.landingpage} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-medium text-gray-500">Material From Customer</label>
						<input name="materialFromCustomer" value={form.materialFromCustomer} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Ready For Approval</label>
						<input type="checkbox" name="readyForApproval" checked={form.readyForApproval} onChange={handleChange} className="ml-2" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Status</label>
						<select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
							{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>
					<div className="md:col-span-2">
						<label className="text-xs font-medium text-gray-500">Comment To Customer</label>
						<input name="commentToCustomer" value={form.commentToCustomer} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Campaign Type</label>
						<select name="campaignType" value={form.campaignType} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
							{CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
						</select>
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Campaign Dimensions</label>
						<input name="campaignDimensions" value={form.campaignDimensions} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Campaign Variation</label>
						<input name="campaignVariation" value={form.campaignVariation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Text To Creative</label>
						<input name="campaignTextToCreative" value={form.campaignTextToCreative} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div>
						<label className="text-xs font-medium text-gray-500">Text To Creative Translation</label>
						<input name="campaignTextToCreativeTranslation" value={form.campaignTextToCreativeTranslation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
					</div>
					<div className="md:col-span-2 flex justify-end mt-4">
						<button type="submit" className="bg-[var(--color-primary-searchmind)] text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-opacity-90 transition">Create Campaign</button>
					</div>
				</form>
			</div>
		</div>
	);
}
