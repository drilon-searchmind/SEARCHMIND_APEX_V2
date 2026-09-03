export const META_GRAPH_VERSION = "v21.0";

/**
 * Remove access_token from a URL string. Returns a redaction marker for Graph paging URLs
 * since they are not usable client-side without the APEX proxy token anyway.
 * @param {string} value
 */
export function redactAccessTokenFromString(value) {
	if (typeof value !== "string" || !value) return value;
	if (!/access_token=/i.test(value)) return value;
	try {
		const parsed = new URL(value);
		parsed.searchParams.delete("access_token");
		if (/graph\.facebook\.com/i.test(parsed.hostname)) {
			return "[redacted-meta-paging-url]";
		}
		return parsed.toString();
	} catch {
		return "[redacted-meta-paging-url]";
	}
}

/**
 * Strip token-bearing paging URLs from Meta Graph API responses.
 * Cursor values are safe to return; full next/previous URLs are not.
 * @param {unknown} paging
 */
export function sanitizeMetaPaging(paging) {
	if (!paging || typeof paging !== "object" || Array.isArray(paging)) {
		return null;
	}

	/** @type {Record<string, unknown>} */
	const out = {};
	const cursors = paging.cursors;
	if (cursors && typeof cursors === "object" && !Array.isArray(cursors)) {
		out.cursors = { ...cursors };
	}
	if (paging.next) out.hasNext = true;
	if (paging.previous) out.hasPrevious = true;

	return Object.keys(out).length > 0 ? out : null;
}

/**
 * @param {string} path
 * @param {string} accessToken
 * @param {Record<string, string>} [searchParams]
 */
export async function metaGraphGet(path, accessToken, searchParams = {}) {
	const params = new URLSearchParams({
		access_token: accessToken,
		...searchParams,
	});
	const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${path}?${params.toString()}`;
	const res = await fetch(url);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(json?.error?.message || `Meta Graph API error ${res.status}`);
	}
	if (json?.paging) {
		json.paging = sanitizeMetaPaging(json.paging);
	}
	return json;
}
