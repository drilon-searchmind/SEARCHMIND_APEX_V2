import { parseMetaIdFilter } from "@/lib/facebookApi";
import { metaGraphGet } from "@root/lib/mcpMetaGraph";

const ALLOWED_INSIGHT_LEVELS = new Set(["account", "campaign", "adset", "ad"]);

const ALLOWED_INSIGHT_FIELDS = new Set([
	"account_id",
	"account_name",
	"campaign_id",
	"campaign_name",
	"adset_id",
	"adset_name",
	"ad_id",
	"ad_name",
	"spend",
	"impressions",
	"reach",
	"frequency",
	"clicks",
	"ctr",
	"cpc",
	"cpm",
	"cpp",
	"unique_clicks",
	"inline_link_clicks",
	"actions",
	"action_values",
	"purchase_roas",
	"cost_per_action_type",
	"date_start",
	"date_stop",
	"objective",
	"social_spend",
]);

const BASE_INSIGHT_FIELDS = [
	"spend",
	"impressions",
	"reach",
	"frequency",
	"clicks",
	"ctr",
	"cpc",
	"cpm",
	"actions",
	"action_values",
	"purchase_roas",
];

const LEVEL_ID_FIELDS = {
	account: ["account_id", "account_name"],
	campaign: ["campaign_id", "campaign_name"],
	adset: ["adset_id", "adset_name", "campaign_id", "campaign_name"],
	ad: ["ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name"],
};

/**
 * @param {string} level
 * @param {string|undefined} fieldsParam
 */
function resolveInsightFields(level, fieldsParam) {
	const raw = String(fieldsParam || "")
		.split(",")
		.map((field) => field.trim())
		.filter(Boolean);

	if (raw.length > 0) {
		const allowed = raw.filter((field) => ALLOWED_INSIGHT_FIELDS.has(field));
		if (allowed.length === 0) {
			throw new Error(
				"params.fields must include at least one allowed insight field (e.g. spend, reach, frequency, action_values)"
			);
		}
		return [...new Set(allowed)].join(",");
	}

	const defaults = [...(LEVEL_ID_FIELDS[level] || []), ...BASE_INSIGHT_FIELDS];
	if (level !== "account") {
		defaults.push("date_start", "date_stop");
	}
	return [...new Set(defaults)].join(",");
}

/**
 * @param {string} adAccountId
 */
function normalizeActId(adAccountId) {
	const raw = String(adAccountId || "").trim();
	if (!raw) return "";
	return raw.startsWith("act_") ? raw : `act_${raw}`;
}

/**
 * Meta insights for MCP — honors level and fields (unlike dashboard fetchFacebookAdsInsights).
 * @param {{
 *   adAccountId: string,
 *   accessToken: string,
 *   startDate: string,
 *   endDate: string,
 *   level?: string,
 *   fields?: string,
 *   dailyBreakdown?: boolean,
 *   metaIdInclude?: string,
 *   metaIdExclude?: string,
 * }} config
 */
export async function fetchMcpMetaInsights({
	adAccountId,
	accessToken,
	startDate,
	endDate,
	level = "account",
	fields,
	dailyBreakdown = false,
	metaIdInclude,
	metaIdExclude,
}) {
	const normalizedLevel = String(level || "account").trim().toLowerCase();
	if (!ALLOWED_INSIGHT_LEVELS.has(normalizedLevel)) {
		throw new Error("level must be one of: account, campaign, adset, ad");
	}

	const actId = normalizeActId(adAccountId);
	const resolvedFields = resolveInsightFields(normalizedLevel, fields);

	/** @type {Record<string, string>} */
	const query = {
		fields: resolvedFields,
		level: normalizedLevel,
		time_range: JSON.stringify({ since: startDate, until: endDate }),
		limit: "500",
	};
	if (dailyBreakdown) {
		query.time_increment = "1";
	}

	const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
	if (effectiveInclude.length > 0) {
		query.filtering = JSON.stringify([
			{ field: "country", operator: "IN", value: effectiveInclude },
		]);
	}

	const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
	if (useBreakdown) {
		query.breakdowns = JSON.stringify(["country"]);
	}

	const json = await metaGraphGet(`${actId}/insights`, accessToken, query);
	let rows = Array.isArray(json.data) ? json.data : [];

	if (useBreakdown && rows.length > 0) {
		rows = rows.filter((row) => {
			const country = String(row.country || "").toUpperCase();
			return country && !exclude.includes(country);
		});
	}

	return {
		data: rows,
		paging: json.paging || null,
		fields: resolvedFields.split(","),
		level: normalizedLevel,
	};
}
