/**
 * Meta insights product_id breakdown often returns `"<id>, <product name>"`.
 * @param {string|undefined} raw
 */
export function parseMetaInsightsProductId(raw) {
	const text = String(raw || "").trim();
	if (!text) return { product_id: "", product_name: "" };
	const comma = text.indexOf(",");
	if (comma <= 0) return { product_id: text, product_name: "" };
	return {
		product_id: text.slice(0, comma).trim(),
		product_name: text.slice(comma + 1).trim(),
	};
}
