import React, { useState } from "react";
import FormButton from "@/components/form/FormButton";
import FormInputText from "@/components/form/FormInputText";
import FormLabel from "@/components/form/FormLabel";

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
		<div className="fixed inset-0 z-50 flex items-center justify-center glassmorphism2">
			<div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
				<button
					className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
					onClick={onClose}
					aria-label="Close"
				>
					×
				</button>
				<h2 className="text-xl font-bold mb-6 text-gray-900">Create New Campaign</h2>
				<form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
					<div className="md:col-span-2">
						<FormLabel htmlFor="services" required>Services</FormLabel>
						<select 
							id="services"
							name="services" 
							multiple 
							value={form.services} 
							onChange={handleChange} 
							className="mt-2 h-24 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
						>
							{SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>

					<div>
						<FormLabel htmlFor="media" required>Media</FormLabel>
						<select 
							id="media"
							name="media" 
							value={form.media} 
							onChange={handleChange} 
							className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
						>
							{MEDIA.map((m) => <option key={m} value={m}>{m}</option>)}
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
						>
							{FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
						</select>
					</div>

					<div>
						<FormLabel htmlFor="countryCode" required>Country Code</FormLabel>
						<FormInputText id="countryCode" name="countryCode" value={form.countryCode} onChange={handleChange} required />
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
						<FormLabel htmlFor="endDate">End Date</FormLabel>
						<input 
							id="endDate"
							type="date" 
							name="endDate" 
							value={form.endDate} 
							onChange={handleChange} 
							className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
						/>
					</div>

					<div className="md:col-span-2">
						<FormLabel htmlFor="campaignName" required>Campaign Name</FormLabel>
						<FormInputText id="campaignName" name="campaignName" value={form.campaignName} onChange={handleChange} required />
					</div>

					<div className="md:col-span-2">
						<FormLabel htmlFor="messageBrief">Message Brief</FormLabel>
						<FormInputText id="messageBrief" name="messageBrief" value={form.messageBrief} onChange={handleChange} />
					</div>

					<div>
						<FormLabel htmlFor="b2bOrB2c" required>B2B or B2C</FormLabel>
						<select 
							id="b2bOrB2c"
							name="b2bOrB2c" 
							value={form.b2bOrB2c} 
							onChange={handleChange} 
							className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
						>
							{B2B_B2C.map((b) => <option key={b} value={b}>{b}</option>)}
						</select>
					</div>

					<div>
						<FormLabel htmlFor="budget" required>Budget (DKK)</FormLabel>
						<FormInputText id="budget" type="number" name="budget" value={form.budget} onChange={handleChange} min="0" required />
					</div>

					<div className="md:col-span-2">
						<FormLabel htmlFor="landingpage">Landing Page</FormLabel>
						<FormInputText id="landingpage" name="landingpage" value={form.landingpage} onChange={handleChange} />
					</div>

					<div className="md:col-span-2">
						<FormLabel htmlFor="materialFromCustomer">Material From Customer</FormLabel>
						<FormInputText id="materialFromCustomer" name="materialFromCustomer" value={form.materialFromCustomer} onChange={handleChange} />
					</div>

					<div>
						<FormLabel htmlFor="campaignType" required>Campaign Type</FormLabel>
						<select 
							id="campaignType"
							name="campaignType" 
							value={form.campaignType} 
							onChange={handleChange} 
							className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
						>
							{CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
						</select>
					</div>

					<div>
						<FormLabel htmlFor="status" required>Status</FormLabel>
						<select 
							id="status"
							name="status" 
							value={form.status} 
							onChange={handleChange} 
							className="mt-2 h-11 w-full rounded-lg border px-4 py-2.5 text-sm text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20"
						>
							{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>

					<div>
						<FormLabel htmlFor="campaignDimensions">Campaign Dimensions</FormLabel>
						<FormInputText id="campaignDimensions" name="campaignDimensions" value={form.campaignDimensions} onChange={handleChange} />
					</div>

					<div>
						<FormLabel htmlFor="campaignVariation">Campaign Variation</FormLabel>
						<FormInputText id="campaignVariation" name="campaignVariation" value={form.campaignVariation} onChange={handleChange} />
					</div>

					<div>
						<FormLabel htmlFor="campaignTextToCreative">Text To Creative</FormLabel>
						<FormInputText id="campaignTextToCreative" name="campaignTextToCreative" value={form.campaignTextToCreative} onChange={handleChange} />
					</div>

					<div>
						<FormLabel htmlFor="campaignTextToCreativeTranslation">Text To Creative Translation</FormLabel>
						<FormInputText id="campaignTextToCreativeTranslation" name="campaignTextToCreativeTranslation" value={form.campaignTextToCreativeTranslation} onChange={handleChange} />
					</div>

					<div className="md:col-span-2">
						<FormLabel htmlFor="commentToCustomer">Comment To Customer</FormLabel>
						<FormInputText id="commentToCustomer" name="commentToCustomer" value={form.commentToCustomer} onChange={handleChange} />
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

					<div className="md:col-span-2 flex justify-end gap-2 mt-4">
						<button 
							type="button" 
							onClick={onClose}
							className="px-6 py-2 rounded-lg font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
						>
							Cancel
						</button>
						<FormButton type="submit">Create Campaign</FormButton>
					</div>
				</form>
			</div>
		</div>
	);
}
