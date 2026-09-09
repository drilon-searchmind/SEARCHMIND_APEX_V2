import { roundN, safeDiv } from "@/lib/performanceBriefDates";

/**
 * Heuristic top-3 optimization opportunities across Meta + Google (fallback + Claude seed).
 * @param {object} compact
 * @returns {string[]}
 */
export function buildPerformanceBriefOptimizations(compact) {
    /** @type {Array<{ score: number, text: string }>} */
    const candidates = [];

    const meta = compact?.meta;
    const google = compact?.google;

    if (meta?.configured && !meta?.error) {
        for (const ad of meta.adsForAnalysis?.worstByRoas || []) {
            if (ad.spend < 50) continue;
            candidates.push({
                score: ad.spend * (ad.roas > 0 ? 1 / ad.roas : 10),
                text: `Meta — pause eller reducér annonce «${ad.name}» (${roundN(ad.spend, 0)} kr spend, ROAS ${roundN(ad.roas, 1)})`,
            });
        }
        for (const t of meta.adTypes || []) {
            if (t.spend < 100 || t.roas >= 1.5) continue;
            candidates.push({
                score: t.spend * (t.roas > 0 ? 1 / t.roas : 8),
                text: `Meta — ${t.type} brænder ${roundN(t.spendSharePct, 0)} % af spend med ROAS ${roundN(t.roas, 1)}; flyt budget til bedre formater`,
            });
        }
        for (const c of (meta.campaigns || []).slice(0, 10)) {
            if (c.spend < 200 || c.roas >= 1.2) continue;
            candidates.push({
                score: c.spend,
                text: `Meta — kampagne «${c.name}» (${roundN(c.spend, 0)} kr, ROAS ${roundN(c.roas, 1)})`,
            });
        }
        const freq = meta.last7?.frequency;
        if (freq >= 3 && meta.last7?.spend > 0) {
            candidates.push({
                score: meta.last7.spend * 0.5,
                text: `Meta — frekvens ${roundN(freq, 1)} på 7 dage; test nye creatives eller udvid målgruppe`,
            });
        }
    }

    if (google?.configured && !google?.error) {
        for (const c of google.campaigns || []) {
            if (c.spend < 100) continue;
            if (c.roas < 1) {
                candidates.push({
                    score: c.spend * (c.roas > 0 ? 1 / c.roas : 10),
                    text: `Google — «${c.name}» (${roundN(c.spend, 0)} kr, ROAS ${roundN(c.roas, 1)})`,
                });
            }
            if (c.budgetLostIs >= 15) {
                candidates.push({
                    score: c.spend * (c.budgetLostIs / 100),
                    text: `Google — «${c.name}» mister ${roundN(c.budgetLostIs, 0)} % IS pga. budget; overvej budgetløft`,
                });
            }
            if (c.rankLostIs >= 20) {
                candidates.push({
                    score: c.spend * (c.rankLostIs / 100),
                    text: `Google — «${c.name}» mister ${roundN(c.rankLostIs, 0)} % IS pga. rang/bud; optimér bud og kvalitet`,
                });
            }
        }
        for (const t of google.campaignTypes || []) {
            if (t.spend < 150 || t.roas >= 1.3) continue;
            candidates.push({
                score: t.spend * safeDiv(1, Math.max(t.roas, 0.1)),
                text: `Google — ${t.type} (${roundN(t.spendSharePct, 0)} % af spend, ROAS ${roundN(t.roas, 1)})`,
            });
        }
    }

    const seen = new Set();
    const out = [];
    for (const row of candidates.sort((a, b) => b.score - a.score)) {
        const key = row.text.slice(0, 60);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row.text);
        if (out.length >= 3) break;
    }
    return out;
}
