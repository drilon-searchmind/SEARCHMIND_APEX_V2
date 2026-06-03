/**
 * SEO "Volumen potentiale" — keywords in GSC positions 4–10, uplift to top-3 CTR.
 */

import {
    ahrefsCountryFromTarget,
    ahrefsGet,
    ahrefsReportDate,
    ahrefsTargetFromGscProperty,
    isAhrefsConfigured,
} from "@/lib/ahrefsApi";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { numHash } from "@/lib/demoAdMetrics";

/** Blended organic CTR for positions 1–3 (used to estimate click potential). */
export const TOP3_ORGANIC_CTR = 0.192;

export const VOLUME_POTENTIAL_POSITION_MIN = 4;
export const VOLUME_POTENTIAL_POSITION_MAX = 10;

function normalizeKeyword(kw) {
    return String(kw || "")
        .trim()
        .toLowerCase();
}

/**
 * @param {unknown} payload
 * @returns {Record<string, number>}
 */
function volumeMapFromAhrefsPayload(payload) {
    const rows = payload?.keywords || payload?.rows || payload || [];
    if (!Array.isArray(rows)) return {};
    const map = {};
    for (const row of rows) {
        const kw = normalizeKeyword(row.keyword ?? row.keys?.[0]);
        const vol = Number(row.volume ?? row.search_volume);
        if (!kw || !Number.isFinite(vol) || vol <= 0) continue;
        if (map[kw] == null || vol > map[kw]) map[kw] = vol;
    }
    return map;
}

export async function fetchAhrefsVolumeByKeyword(siteUrl, endDate) {
    const target = ahrefsTargetFromGscProperty(siteUrl);
    if (!target || !isAhrefsConfigured()) return {};

    try {
        const date = ahrefsReportDate(endDate);
        const country = ahrefsCountryFromTarget(target);
        const res = await ahrefsGet("/site-explorer/organic-keywords", {
            target,
            date,
            mode: "subdomains",
            protocol: "both",
            country,
            limit: 1000,
            select: "keyword,volume",
            order_by: "volume:desc",
        });
        const rows = res?.keywords || res?.rows || [];
        return volumeMapFromAhrefsPayload({ rows: Array.isArray(rows) ? rows : [] });
    } catch {
        return {};
    }
}

/**
 * @param {Array<{ keys?: string[], clicks?: number, impressions?: number, position?: number, ctr?: number }>} gscRows
 * @param {Record<string, number>} volumeByKeyword
 * @param {{ avgCpc?: number|null, revenuePerClick?: number|null }} economics
 */
export function buildVolumePotentialRows(gscRows, volumeByKeyword, economics = {}) {
    const avgCpc = economics.avgCpc ?? null;
    const revenuePerClick = economics.revenuePerClick ?? null;
    const rows = [];

    for (const row of gscRows || []) {
        const keyword = row.keys?.[0];
        if (!keyword) continue;
        const position = Number(row.position);
        if (!Number.isFinite(position) || position < VOLUME_POTENTIAL_POSITION_MIN || position > VOLUME_POTENTIAL_POSITION_MAX) {
            continue;
        }

        const clicksNow = row.clicks || 0;
        const impressions = row.impressions || 0;
        const norm = normalizeKeyword(keyword);
        let volume = volumeByKeyword[norm] ?? null;
        if (volume == null && impressions > 0) {
            volume = Math.round(impressions * 4);
        }
        if (!volume || volume <= 0) continue;

        const potentialClicks = Math.round(volume * TOP3_ORGANIC_CTR);
        const uplift = Math.max(0, potentialClicks - clicksNow);
        const valueNow =
            revenuePerClick != null && clicksNow > 0 ? clicksNow * revenuePerClick : null;
        const valuePotential =
            revenuePerClick != null && potentialClicks > 0 ? potentialClicks * revenuePerClick : null;
        const valueUplift =
            valueNow != null && valuePotential != null ? valuePotential - valueNow : null;
        const spendSaved = avgCpc != null && clicksNow > 0 ? clicksNow * avgCpc : null;

        rows.push({
            id: norm,
            keyword,
            position: Math.round(position * 100) / 100,
            volume,
            clicks_now: clicksNow,
            potential_clicks: potentialClicks,
            uplift,
            value_now: valueNow,
            value_potential: valuePotential,
            value_uplift: valueUplift,
            spend_saved: spendSaved,
        });
    }

    rows.sort((a, b) => (b.value_uplift ?? 0) - (a.value_uplift ?? 0) || b.uplift - a.uplift);
    return rows;
}

export function buildDemoVolumePotentialRows() {
    const template = getDemoPayload("seoVolumePotential") || {};
    if (Array.isArray(template.rows) && template.rows.length > 0) {
        return template.rows;
    }

    const samples = [
        ["fotograf priser", 4, 2297, 138],
        ["billeder til webshop", 5, 1532, 109],
        ["produktfotograf", 6, 980, 72],
        ["webshop billeder", 7, 840, 58],
        ["ecommerce fotos", 4, 720, 51],
        ["packshot pris", 5, 610, 44],
        ["produktbilleder", 6, 540, 38],
        ["foto webshop", 7, 490, 31],
        ["studio fotograf", 8, 420, 28],
        ["billeder produkt", 8, 380, 24],
        ["webshop foto", 9, 350, 22],
        ["produktfoto", 9, 310, 19],
        ["packshots", 10, 290, 17],
        ["ecommerce billeder", 10, 260, 15],
        ["fotograf til webshop", 4, 240, 14],
        ["professionelle produktbilleder", 5, 220, 12],
        ["billige produktfotos", 6, 200, 11],
    ];
    const avgCpc = 14.2;
    const rpc = 112;

    return samples.map(([keyword, position, volume, clicks_now], i) => {
        const potential_clicks = Math.round(volume * TOP3_ORGANIC_CTR);
        const uplift = Math.max(0, potential_clicks - clicks_now);
        const value_now = clicks_now * rpc;
        const value_potential = potential_clicks * rpc;
        return {
            id: `demo-vp-${i}`,
            keyword,
            position,
            volume,
            clicks_now,
            potential_clicks,
            uplift,
            value_now,
            value_potential,
            value_uplift: value_potential - value_now,
            spend_saved: clicks_now * avgCpc,
        };
    });
}

export async function fetchSeoVolumePotentialData({
    customerId,
    siteUrl,
    startDate,
    endDate,
    gscKeywordRows,
    supplemental,
}) {
    if (customerId && isDemoCustomerId(customerId)) {
        return { rows: buildDemoVolumePotentialRows() };
    }

    const totalClicks = (gscKeywordRows || []).reduce((s, r) => s + (r.clicks || 0), 0);
    const organicRevenue = supplemental?.organic_revenue ?? null;
    const revenuePerClick =
        totalClicks > 0 && organicRevenue != null ? organicRevenue / totalClicks : null;
    const avgCpc = supplemental?.avg_cpc ?? null;

    const volumeByKeyword = await fetchAhrefsVolumeByKeyword(siteUrl, endDate);
    const rows = buildVolumePotentialRows(gscKeywordRows, volumeByKeyword, {
        avgCpc,
        revenuePerClick,
    });

    return { rows, meta: { avgCpc, revenuePerClick } };
}
