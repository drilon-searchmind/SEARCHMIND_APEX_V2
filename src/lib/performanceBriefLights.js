/** Deterministic traffic lights from the Performance Brief spec. */

export function metricLight(metric, pct, extra = {}) {
    if (pct == null || !Number.isFinite(Number(pct))) return "yellow";
    const p = Number(pct);

    if (metric === "spend") return "yellow";

    if (metric === "revenue") {
        if (p < -2) return "red";
        const spendPct = extra.spendPct;
        if (p > 2 && spendPct != null && spendPct > 15 && p < spendPct * 0.45) return "yellow";
        if (p > 2) return "green";
        return "yellow";
    }

    if (metric === "roas") {
        if (p > 5) return "green";
        if (p < -25) return "red";
        return "yellow";
    }

    if (metric === "conversions" || metric === "leads") {
        if (p > 5) return "green";
        if (p < -5) return "red";
        return "yellow";
    }

    if (metric === "cpa" || metric === "cpl") {
        if (p < -2) return "green";
        if (p > 25) return "red";
        return "yellow";
    }

    if (metric === "frequency") {
        const current = extra.current;
        if (p > 0 && current != null && current >= 6) return "red";
        if (p > 2) return "yellow";
        if (p < -2) return "green";
        return "yellow";
    }

    return "yellow";
}

export function channelLight(window7) {
    const vs = window7?.vsPrev || {};
    const spend = Number(vs.spend);
    const revenue = Number(vs.revenue);
    const conversions = Number(vs.conversions);
    const roas = Number(vs.roas);

    const revenueDown = Number.isFinite(revenue) && revenue < -2;
    const spendUp = Number.isFinite(spend) && spend > 5;
    const roasHalved = Number.isFinite(roas) && roas <= -50;
    if ((revenueDown && spendUp) || roasHalved) return "red";

    const revenueUp = Number.isFinite(revenue) && revenue > 2;
    const convUp = Number.isFinite(conversions) && conversions > 2;
    const roasHolds = !Number.isFinite(roas) || roas >= -5;
    if (revenueUp && convUp && roasHolds) return "green";

    return "yellow";
}
