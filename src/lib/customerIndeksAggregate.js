/**
 * The CRM matches on ClickUp id, but several Apex customers (one per domain/market) can share one.
 * They are one customer to the CRM, so roll them up into ONE row per ClickUp id: the headline Indeks
 * (and each channel Indeks) is the simple AVERAGE of the members' individual Indeks values.
 * Members without a computable Indeks (null) are left out of the average.
 *
 * @param {Array<{ clickupId: string, name: string, category: "ecommerce"|"b2b", snap: object|null }>} members
 */
function average(values) {
    const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
    if (!nums.length) return null;
    return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10;
}

export function rollUpClickupGroup(clickupId, members) {
    const withSnap = members.filter((m) => m.snap);
    const pending = members.length - withSnap.length;
    const multi = members.length > 1;

    // Mixed ecommerce + B2B under one ClickUp id: prefer ecommerce (revenue) for the headline.
    const categories = new Set(members.map((m) => m.category));
    const mixed = categories.size > 1;
    const headlineCategory = categories.has("ecommerce") ? "ecommerce" : "b2b";
    const headlineMembers = withSnap.filter((m) => m.category === headlineCategory);

    const memberIndeks = headlineMembers.map((m) => m.snap.indeks);
    const indeks = average(memberIndeks);
    const errored = headlineMembers.filter((m) => m.snap.status === "error").length;

    let status = "no_data";
    if (!withSnap.length) status = "pending";
    else if (indeks != null) status = "ok";
    else if (headlineMembers.some((m) => m.snap.status === "insufficient_history")) {
        status = "insufficient_history";
    } else if (errored > 0 && errored === headlineMembers.length) status = "error";

    // Per-channel: average of each member's channel Indeks.
    const channelMap = new Map();
    for (const m of headlineMembers) {
        for (const c of m.snap.perChannel || []) {
            if (!channelMap.has(c.channel)) {
                channelMap.set(c.channel, {
                    channel: c.channel,
                    label: c.label,
                    metric: c.metric,
                    headline: Boolean(c.headline),
                    items: [],
                });
            }
            channelMap.get(c.channel).items.push(c);
        }
    }
    const perChannel = [...channelMap.values()]
        .filter((c) => c.items.some((i) => i.status !== "not_connected"))
        .map((c) => {
            const idx = average(c.items.map((i) => i.indeks));
            const single = !multi ? c.items[0] : null;
            let chStatus = "no_data";
            if (idx != null) chStatus = "ok";
            else if (c.items.some((i) => i.status === "insufficient_history")) chStatus = "insufficient_history";
            else if (c.items.every((i) => i.status === "error")) chStatus = "error";
            return {
                channel: c.channel,
                label: c.label,
                metric: c.metric,
                headline: c.headline,
                // Absolute numbers only make sense for a single customer (shared ad accounts would double count).
                current: single?.current ?? null,
                previous: single?.previous ?? null,
                indeks: idx,
                status: chStatus,
            };
        });

    const stamps = withSnap
        .map((m) => (m.snap.computedAt ? new Date(m.snap.computedAt).getTime() : 0))
        .filter(Boolean);
    const oldest = stamps.length ? Math.min(...stamps) : null;
    const anySnap = headlineMembers[0]?.snap || withSnap[0]?.snap || null;

    return {
        customerClickupId: clickupId,
        customerName: members[0]?.name || "",
        businessCategory: headlineCategory,
        headlineMetric: anySnap?.headlineMetric || null,
        indeks,
        status,
        aggregation: multi ? "average" : "single",
        perChannel,
        window: anySnap
            ? {
                  start: anySnap.windowStart,
                  end: anySnap.windowEnd,
                  compareStart: anySnap.compareStart,
                  compareEnd: anySnap.compareEnd,
              }
            : null,
        // Oldest member timestamp, so a stale member is never hidden behind a fresh one.
        computedAt: oldest ? new Date(oldest).toISOString() : null,
        customerCount: members.length,
        partial: pending > 0 || errored > 0 || mixed,
        members: multi
            ? members.map((m) => ({
                  customerName: m.name,
                  businessCategory: m.category,
                  indeks: m.snap?.indeks ?? null,
                  status: m.snap?.status ?? "pending",
              }))
            : undefined,
    };
}
