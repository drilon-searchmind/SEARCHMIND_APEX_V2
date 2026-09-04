import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { getCustomerById } from "@root/lib/customerOperations";

/**
 * @param {string} customerId
 */
async function loadCustomerSettingsForMeta(customerId) {
	const id = String(customerId || "").trim();
	if (!id) throw new Error("customerId is required");

	if (isDemoCustomerId(id)) {
		const customer = getDemoPayload("customer");
		return {
			id,
			settings: {
				customerName: customer?.customerName,
				customerType: customer?.customerType || "Shopify",
				...(customer?.CustomerSettings || {}),
			},
			isDemo: true,
		};
	}

	const doc = await getCustomerById(id);
	if (!doc) throw new Error("Customer not found");
	const data = doc.toObject ? doc.toObject() : doc;
	return {
		id,
		settings: {
			customerName: data.customerName,
			customerType: data.customerType || "Shopify",
			...(data.CustomerSettings || {}),
		},
		isDemo: false,
	};
}

/**
 * Resolve Meta ad account for a customer (shared by Meta MCP handlers).
 * @param {string} customerId
 */
export async function loadMetaAdAccountForMcp(customerId) {
	const customer = await loadCustomerSettingsForMeta(customerId);
	const cs = customer.settings || {};
	const adAccountId = cs.facebookAdAccountId;
	if (!adAccountId && !customer.isDemo) {
		throw new Error("Meta ad account not configured for this customer");
	}
	const token = process.env.FACEBOOK_APP_TOKEN;
	if (!token && !customer.isDemo) {
		throw new Error("Facebook app token not configured on server");
	}
	return {
		adAccountId: adAccountId || "act_demo",
		metaIdInclude: cs.customerMetaID || "",
		metaIdExclude: cs.customerMetaIDExclude || "",
		accessToken: token || "",
		isDemo: customer.isDemo,
	};
}
