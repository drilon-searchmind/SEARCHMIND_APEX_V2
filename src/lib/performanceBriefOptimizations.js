import { roundN, safeDiv } from "@/lib/performanceBriefDates";
import { detectAccountIntent, num } from "@/lib/performanceBriefIntent";

function rowKpi(row) {
    return row?.kpi ?? null;
}

function rowLeadCount(row, businessCategory) {
    if (businessCategory === "b2b") {
        return num(row.leads ?? row.conversions);
    }
    return num(row.leads ?? row.conversions);
}

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
    const businessCategory = compact?.customer?.businessCategory || "ecommerce";

    if (meta?.configured && !meta?.error) {
        for (const t of meta.adTypes || []) {
            const kpi = rowKpi(t);
            if (kpi === "ROAS") {
                if (t.spend < 100 || t.roas >= 1.5) continue;
                if (t.valueMissing) {
                    candidates.push({
                        score: t.spend,
                        text: `Meta — ${t.type} registrerer køb uden omsætningsværdi (${roundN(t.spend, 0)} kr spend) — tjek tracking`,
                    });
                    continue;
                }
                candidates.push({
                    score: t.spend * (t.roas > 0 ? 1 / t.roas : 8),
                    text: `Meta — ${t.type} brænder ${roundN(t.spendSharePct, 0)} % af spend med ROAS ${roundN(t.roas, 1)}; flyt budget til bedre formater`,
                });
            } else if (kpi === "CPA") {
                const leads = rowLeadCount(t, businessCategory);
                const cpa = safeDiv(t.spend, leads);
                if (t.spend < 100 || (leads >= 5 && cpa <= 300)) continue;
                candidates.push({
                    score: t.spend * (leads > 0 ? cpa / 100 : 12),
                    text: leads
                        ? `Meta — ${t.type} koster ${roundN(cpa, 0)} kr/lead (${roundN(t.spend, 0)} kr spend, ${roundN(leads, 0)} leads)`
                        : `Meta — ${t.type} brænder ${roundN(t.spendSharePct, 0)} % af spend uden leads i perioden`,
                });
            } else if (t.spend >= 150) {
                candidates.push({
                    score: t.spend,
                    text: `Meta — ${t.type} bruger ${roundN(t.spendSharePct, 0)} % af spend; ingen målt konvertering — tjek konverteringssporing`,
                });
            }
        }
        if (metaIntent?.primaryKpi === "ROAS") {
            for (const ad of meta.adsForAnalysis?.worstByRoas || []) {
                if (ad.spend < 50) continue;
                candidates.push({
                    score: ad.spend * (ad.roas > 0 ? 1 / ad.roas : 10),
                    text: `Meta — pause eller reducér annonce «${ad.name}» (${roundN(ad.spend, 0)} kr spend, ROAS ${roundN(ad.roas, 1)})`,
                });
            }
        }
        for (const c of (meta.campaigns || []).slice(0, 10)) {
            const kpi = rowKpi(c);
            if (kpi === "ROAS") {
                if (c.spend < 200 || c.roas >= 1.2) continue;
                if (c.valueMissing) {
                    candidates.push({
                        score: c.spend,
                        text: `Meta — kampagne «${c.name}» (${roundN(c.spend, 0)} kr) registrerer køb uden omsætningsværdi — tjek tracking`,
                    });
                    continue;
                }
                candidates.push({
                    score: c.spend,
                    text: `Meta — kampagne «${c.name}» (${roundN(c.spend, 0)} kr, ROAS ${roundN(c.roas, 1)})`,
                });
            } else if (kpi === "CPA") {
                const leads = rowLeadCount(c, businessCategory);
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
        for (const t of google.campaignTypes || []) {
            const kpi = rowKpi(t);
            if (kpi === "ROAS") {
                if (t.spend < 150 || t.roas >= 1.3) continue;
                if (t.valueMissing) {
                    candidates.push({
                        score: t.spend,
                        text: `Google — ${t.type} registrerer køb uden omsætningsværdi — tjek tracking`,
                    });
                    continue;
                }
                candidates.push({
                    score: t.spend * safeDiv(1, Math.max(t.roas, 0.1)),
                    text: `Google — ${t.type} (${roundN(t.spendSharePct, 0)} % af spend, ROAS ${roundN(t.roas, 1)})`,
                });
            } else if (kpi === "CPA") {
                const leads = rowLeadCount(t, businessCategory);
                const cpa = safeDiv(t.spend, leads);
                if (t.spend < 150 || (leads >= 5 && cpa <= 250)) continue;
                candidates.push({
                    score: t.spend * (leads > 0 ? cpa / 100 : 10),
                    text: leads
                        ? `Google — ${t.type} (${roundN(t.spendSharePct, 0)} % af spend, ${roundN(cpa, 0)} kr/lead)`
                        : `Google — ${t.type} brænder budget uden leads i perioden`,
                });
            } else if (t.spend >= 150) {
                candidates.push({
                    score: t.spend,
                    text: `Google — ${t.type} (${roundN(t.spendSharePct, 0)} % af spend); ingen målt konvertering — verificér konverteringssporing`,
                });
            }
        }
        for (const c of google.campaigns || []) {
            const kpi = rowKpi(c);
            if (c.spend < 100) continue;
            if (kpi === "ROAS") {
                if (c.roas < 1) {
                    if (c.valueMissing) {
                        candidates.push({
                            score: c.spend,
                            text: `Google — «${c.name}» (${roundN(c.spend, 0)} kr) registrerer køb uden omsætningsværdi — tjek tracking`,
                        });
                    } else {
                        candidates.push({
                            score: c.spend * (c.roas > 0 ? 1 / c.roas : 10),
                            text: `Google — «${c.name}» (${roundN(c.spend, 0)} kr, ROAS ${roundN(c.roas, 1)})`,
                        });
                    }
                }
            } else if (kpi === "CPA") {
                const leads = rowLeadCount(c, businessCategory);
                const cpa = safeDiv(c.spend, leads);
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
