/**
 * Ensure MCP proxy payloads cannot return another customer's id in nested data.
 * @param {string} customerId
 * @param {unknown} data
 * @param {string} [label]
 */
export function assertMcpProxyCustomerData(customerId, data, label = "proxy") {
	const expected = String(customerId || "").trim();
	if (!expected || data == null || typeof data !== "object" || Array.isArray(data)) {
		return;
	}

	/** @type {Record<string, unknown>} */
	const payload = data;
	const nestedId = String(payload.customerId ?? "").trim();
	if (nestedId && nestedId !== expected) {
		throw new Error(
			`${label} returned customerId ${nestedId} but request was for ${expected}`
		);
	}
}
