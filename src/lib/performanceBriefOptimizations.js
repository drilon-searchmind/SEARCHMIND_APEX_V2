import { roundN, safeDiv } from "@/lib/performanceBriefDates";
import { detectAccountIntent, num } from "@/lib/performanceBriefIntent";

/**
 * Heuristic top-3 optimization opportunities across Meta + Google (fallback + Claude seed).
 * @param {object} compact
 * @param {object} [accountIntent]
 * @returns {string[]}
 */
export function buildPerformanceBriefOptimizations(compact, accountIntent) {
    /** @type {Array<{ score: number, text: string }>} */
    const candidates = [];

    const meta = compact?.meta;
    const google = compact?.google;
    const intent =
        accountIntent || compact?.accountIntent || detectAccountIntent(compact);
    const metaIntent = intent?.meta;
    const googleIntent = intent?.google;

    if (meta?.configured && !meta?.error) {
        if (metaIntent?.primaryKpi === "ROAS") {
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
        } else if (metaIntent?.primaryKpi === "CPA") {
            for (const t of meta.adTypes || []) {
                const leads = num(t.conversions);
                const cpa = safeDiv(t.spend, leads);
                if (t.spend < 100 || (leads >= 5 && cpa <= 300)) continue;
                candidates.push({
                    score: t.spend * (leads > 0 ? cpa / 100 : 12),
                    text: leads
                        ? `Meta — ${t.type} koster ${roundN(cpa, 0)} kr/lead (${roundN(t.spend, 0)} kr spend, ${roundN(leads, 0)} leads)`
                        : `Meta — ${t.type} brænder ${roundN(t.spendSharePct, 0)} % af spend uden leads i perioden`,
                });
            }
            for (const c of (meta.campaigns || []).slice(0, 10)) {
                const leads = num(c.conversions);
                const cpa = safeDiv(c.spend, leads);
                if (c.spend < 150) continue;
                if (!leads) {
                    candidates.push({
                        score: c.spend,
                        text: `Meta — kampagne «${c.name}» (${roundN(c.spend, 0)} kr spend, 0 leads)`,
                    });
                } else if (cpa > 400) {
                    candidates.push({
                        score: c.spend * (cpa / 100),
                        text: `Meta — kampagne «${c.name}» (${roundN(c.spend, 0)} kr, ${roundN(cpa, 0)} kr/lead, ${roundN(leads, 0)} leads)`,
                    });
                }
            }
        } else {
            for (const t of meta.adTypes || []) {
                if (t.spend < 150) continue;
                candidates.push({
                    score: t.spend,
                    text: `Meta — ${t.type} bruger ${roundN(t.spendSharePct, 0)} % af spend; effekt kan ikke måles — tjek konverteringssporing`,
                });
            }
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
        if (googleIntent?.primaryKpi === "ROAS") {
            for (const c of google.campaigns || []) {
                if (c.spend < 100) continue;
                if (c.roas < 1) {
                    candidates.push({
                        score: c.spend * (c.roas > 0 ? 1 / c.roas : 10),
                        text: `Google — «${c.name}» (${roundN(c.spend, 0)} kr, ROAS ${roundN(c.roas, 1)})`,
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
        } else if (googleIntent?.primaryKpi === "CPA") {
            for (const c of google.campaigns || []) {
                const leads = num(c.conversions);
                const cpa = safeDiv(c.spend, leads);
                if (c.spend < 100) continue;
                if (!leads) {
                    candidates.push({
                        score: c.spend,
                        text: `Google — «${c.name}» (${roundN(c.spend, 0)} kr spend, 0 leads)`,
                    });
                } else if (cpa > 300) {
                    candidates.push({
                        score: c.spend * (cpa / 100),
                        text: `Google — «${c.name}» (${roundN(c.spend, 0)} kr, ${roundN(cpa, 0)} kr/lead, ${roundN(leads, 0)} leads)`,
                    });
                }
            }
            for (const t of google.campaignTypes || []) {
                const leads = num(t.conversions);
                const cpa = safeDiv(t.spend, leads);
                if (t.spend < 150 || (leads >= 5 && cpa <= 250)) continue;
                candidates.push({
                    score: t.spend * (leads > 0 ? cpa / 100 : 10),
                    text: leads
                        ? `Google — ${t.type} (${roundN(t.spendSharePct, 0)} % af spend, ${roundN(cpa, 0)} kr/lead)`
                        : `Google — ${t.type} brænder budget uden leads i perioden`,
                });
            }
        } else {
            for (const t of google.campaignTypes || []) {
                if (t.spend < 150) continue;
                candidates.push({
                    score: t.spend,
                    text: `Google — ${t.type} (${roundN(t.spendSharePct, 0)} % af spend); effekt kan ikke måles — verificér konverteringssporing`,
                });
            }
        }

        for (const c of google.campaigns || []) {
            if (c.spend < 100) continue;
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
