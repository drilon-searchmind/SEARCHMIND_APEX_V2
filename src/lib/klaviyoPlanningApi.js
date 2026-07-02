/**
 * Klaviyo planning data — scheduled campaigns and flow setup (read-only).
 * Uses Klaviyo REST API (revision 2024-10-15).
 *
 * Required API key scopes: campaigns:read, flows:read
 * @see https://developers.klaviyo.com/en/reference/get_campaigns
 * @see https://developers.klaviyo.com/en/reference/get_flows
 */

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
const REVISION = "2024-10-15";
const RATE_LIMIT_DELAY_MS = 500;

/** @readonly */
const PLANNED_CAMPAIGN_STATUSES = new Set([
    "Scheduled",
    "Draft",
    "Preparing to schedule",
    "Preparing to send",
    "Queued without Recipients",
    "Adding Recipients",
]);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @param {string} apiKey
 */
async function klaviyoGetJson(url, apiKey) {
    const res = await fetch(url, {
        headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            Accept: "application/json",
            revision: REVISION,
        },
    });
    if (!res.ok) {
        let detail = "";
        try {
            const errJson = await res.json();
            detail = errJson.errors?.[0]?.detail || JSON.stringify(errJson);
        } catch {
            detail = await res.text();
        }
        throw new Error(`Klaviyo API error ${res.status}: ${detail}`);
    }
    return res.json();
}

/**
 * @param {string} initialPath
 * @param {string} apiKey
 * @param {{ maxPages?: number }} [opts]
 */
async function klaviyoPaginate(initialPath, apiKey, opts = {}) {
    const maxPages = opts.maxPages ?? 50;
    /** @type {unknown[]} */
    const data = [];
    /** @type {unknown[]} */
    const included = [];
    let url = initialPath.startsWith("http") ? initialPath : `${KLAVIYO_BASE}${initialPath}`;
    let pages = 0;

    while (url && pages < maxPages) {
        const json = await klaviyoGetJson(url, apiKey);
        data.push(...(json.data || []));
        included.push(...(json.included || []));
        url = json.links?.next || null;
        pages += 1;
        if (url) await sleep(RATE_LIMIT_DELAY_MS);
    }

    return { data, included, truncated: Boolean(url) };
}

/**
 * @param {unknown} campaign
 * @param {unknown[]} included
 */
function serializeScheduledCampaign(campaign, included) {
    const c = /** @type {Record<string, unknown>} */ (campaign);
    const attrs = /** @type {Record<string, unknown>} */ (c.attributes || {});
    const rel = /** @type {Record<string, unknown>} */ (c.relationships || {});
    const msgRel = /** @type {{ data?: Array<{ id: string }> }} */ (
        rel["campaign-messages"] || {}
    );
    const messageIds = new Set((msgRel.data || []).map((m) => m.id));
    const messages = (included || [])
        .filter(
            (inc) =>
                /** @type {Record<string, unknown>} */ (inc).type === "campaign-message" &&
                messageIds.has(/** @type {{ id: string }} */ (inc).id)
        )
        .map((inc) => {
            const row = /** @type {Record<string, unknown>} */ (inc);
            const a = /** @type {Record<string, unknown>} */ (row.attributes || {});
            const content = /** @type {Record<string, unknown>} */ (a.content || {});
            return {
                id: row.id,
                label: a.label || null,
                subject: content.subject || null,
                previewText: content.preview_text || null,
                channel: a.channel || "email",
            };
        });

    const audiences = /** @type {Record<string, unknown>} */ (attrs.audiences || {});
    const sendStrategy = /** @type {Record<string, unknown>} */ (attrs.send_strategy || {});

    return {
        id: c.id,
        name: attrs.name || "",
        status: attrs.status || "",
        scheduledAt: attrs.scheduled_at || null,
        archived: Boolean(attrs.archived),
        audiences: {
            included: audiences.included || [],
            excluded: audiences.excluded || [],
        },
        sendStrategy: sendStrategy.method || null,
        messages,
    };
}

/**
 * @param {Array<{ scheduledAt: string|null, status: string }>} campaigns
 */
function summarizeCampaignsByWeek(campaigns) {
    /** @type {Record<string, number>} */
    const byWeek = {};
    for (const c of campaigns) {
        if (!c.scheduledAt) continue;
        const d = new Date(c.scheduledAt);
        if (Number.isNaN(d.getTime())) continue;
        const weekStart = new Date(d);
        weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
        const key = weekStart.toISOString().slice(0, 10);
        byWeek[key] = (byWeek[key] || 0) + 1;
    }
    return Object.entries(byWeek)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, count]) => ({ weekStart, count }));
}

/**
 * Planned / scheduled email campaigns (real-time calendar view).
 *
 * @param {string} apiKey
 * @param {{ daysAhead?: number, includeDrafts?: boolean }} [options]
 */
export async function fetchKlaviyoScheduledCampaigns(apiKey, options = {}) {
    if (!apiKey?.trim()) throw new Error("Klaviyo Private API Key is required");

    const daysAhead = Math.min(Math.max(Number(options.daysAhead) || 60, 1), 180);
    const includeDrafts = options.includeDrafts !== false;
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + daysAhead);

    const path =
        "/campaigns/?filter=equals(messages.channel,'email')&sort=scheduled_at&include=campaign-messages";
    const { data, included, truncated } = await klaviyoPaginate(path, apiKey.trim());

    /** @type {ReturnType<typeof serializeScheduledCampaign>[]} */
    const campaigns = [];
    for (const item of data) {
        const row = serializeScheduledCampaign(item, included);
        if (!PLANNED_CAMPAIGN_STATUSES.has(row.status)) continue;
        if (!includeDrafts && row.status === "Draft") continue;

        if (row.scheduledAt) {
            const sched = new Date(row.scheduledAt);
            if (sched > windowEnd && row.status !== "Draft") continue;
            if (sched < now && row.status === "Sent") continue;
        } else if (row.status !== "Draft") {
            continue;
        }

        campaigns.push(row);
    }

    campaigns.sort((a, b) => {
        if (!a.scheduledAt && !b.scheduledAt) return a.name.localeCompare(b.name);
        if (!a.scheduledAt) return 1;
        if (!b.scheduledAt) return -1;
        return String(a.scheduledAt).localeCompare(String(b.scheduledAt));
    });

    return {
        readOnly: true,
        daysAhead,
        includeDrafts,
        generatedAt: new Date().toISOString(),
        truncated,
        summary: {
            total: campaigns.length,
            scheduled: campaigns.filter((c) => c.status === "Scheduled").length,
            draft: campaigns.filter((c) => c.status === "Draft").length,
            preparing: campaigns.filter((c) =>
                ["Preparing to schedule", "Preparing to send", "Adding Recipients"].includes(
                    c.status
                )
            ).length,
            byWeek: summarizeCampaignsByWeek(campaigns),
        },
        campaigns,
    };
}

/**
 * @param {unknown} action
 */
function mapFlowActionType(action) {
    const a = /** @type {Record<string, unknown>} */ (action);
    const attrs = /** @type {Record<string, unknown>} */ (a.attributes || {});
    const def = /** @type {Record<string, unknown>} */ (attrs.definition || {});
    const defData = /** @type {Record<string, unknown>} */ (def.data || {});
    const raw =
        attrs.action_type ||
        def.type ||
        defData.action_type ||
        defData.type ||
        "unknown";
    const s = String(raw).toLowerCase();
    if (s.includes("delay") || s === "time-delay") return "delay";
    if (s.includes("send") && s.includes("email")) return "send_email";
    if (s.includes("send") && s.includes("sms")) return "send_sms";
    if (s.includes("split")) return "split";
    if (s.includes("trigger")) return "trigger";
    return String(raw);
}

/**
 * @param {unknown} action
 */
function extractFlowDelay(action) {
    const a = /** @type {Record<string, unknown>} */ (action);
    const attrs = /** @type {Record<string, unknown>} */ (a.attributes || {});
    const def = /** @type {Record<string, unknown>} */ (attrs.definition || {});
    const defData = /** @type {Record<string, unknown>} */ (def.data || {});
    return {
        unit: defData.unit || defData.delay_units || null,
        value: defData.value ?? defData.delay ?? null,
        delayUntilTime: defData.delay_until_time || null,
        delayUntilWeekdays: defData.delay_until_weekdays || null,
    };
}

/**
 * @param {string} apiKey
 * @param {string} flowId
 */
async function fetchFlowActionsForFlow(apiKey, flowId) {
    const path = `/flows/${flowId}/flow-actions/?include=flow-messages`;
    const { data, included } = await klaviyoPaginate(path, apiKey, { maxPages: 20 });

    const messagesById = new Map();
    for (const inc of included) {
        const row = /** @type {Record<string, unknown>} */ (inc);
        if (row.type === "flow-message") messagesById.set(String(row.id), row);
    }

    return data.map((action) => {
        const a = /** @type {Record<string, unknown>} */ (action);
        const attrs = /** @type {Record<string, unknown>} */ (a.attributes || {});
        const type = mapFlowActionType(action);
        /** @type {Record<string, unknown>} */
        const step = {
            id: a.id,
            type,
            status: attrs.status || null,
        };
        if (type === "delay") {
            step.delay = extractFlowDelay(action);
        }
        const rel = /** @type {Record<string, unknown>} */ (a.relationships || {});
        const msgRel = /** @type {{ data?: Array<{ id: string }> }} */ (rel["flow-messages"] || {});
        step.messages = (msgRel.data || []).map((ref) => {
            const msg = messagesById.get(ref.id);
            const mAttrs = /** @type {Record<string, unknown>} */ (
                msg ? /** @type {Record<string, unknown>} */ (msg).attributes || {} : {}
            );
            const content = /** @type {Record<string, unknown>} */ (mAttrs.content || {});
            return {
                id: ref.id,
                name: mAttrs.name || mAttrs.label || null,
                subject: content.subject || null,
                channel: mAttrs.channel || "email",
            };
        });
        return step;
    });
}

/**
 * @param {unknown} flow
 * @param {ReturnType<typeof fetchFlowActionsForFlow> extends Promise<infer R> ? R : never} steps
 */
function serializeFlowOverview(flow, steps) {
    const f = /** @type {Record<string, unknown>} */ (flow);
    const attrs = /** @type {Record<string, unknown>} */ (f.attributes || {});
    const def = /** @type {Record<string, unknown>} */ (attrs.definition || {});
    const triggers = /** @type {unknown[]} */ (def.triggers || []);
    const firstTrigger = /** @type {Record<string, unknown>} */ (triggers[0] || {});
    const triggerData = /** @type {Record<string, unknown>} */ (firstTrigger.data || {});

    const emailSteps = steps.filter((s) => s.type === "send_email");

    return {
        id: f.id,
        name: attrs.name || "",
        status: attrs.status || "",
        triggerType: triggerData.trigger_type || attrs.trigger_type || null,
        archived: Boolean(attrs.archived),
        updated: attrs.updated || null,
        created: attrs.created || null,
        stepCount: steps.length,
        emailStepCount: emailSteps.length,
        steps,
    };
}

/**
 * Flow setup overview — triggers, delays, and email steps per flow.
 *
 * @param {string} apiKey
 * @param {{ includeActions?: boolean, status?: string|null, maxFlows?: number }} [options]
 */
export async function fetchKlaviyoFlowsOverview(apiKey, options = {}) {
    if (!apiKey?.trim()) throw new Error("Klaviyo Private API Key is required");

    const includeActions = options.includeActions !== false;
    const maxFlows = Math.min(Math.max(Number(options.maxFlows) || 80, 1), 150);
    const status = options.status ? String(options.status).trim().toLowerCase() : null;

    let filter = "equals(archived,false)";
    if (status) {
        filter = `and(equals(archived,false),equals(status,'${status}'))`;
    }

    const path = `/flows/?filter=${encodeURIComponent(filter)}&sort=-updated`;
    const { data: flowRows, truncated: flowsTruncated } = await klaviyoPaginate(
        path,
        apiKey.trim(),
        { maxPages: Math.ceil(maxFlows / 50) + 1 }
    );

    const flowsToProcess = flowRows.slice(0, maxFlows);
    /** @type {ReturnType<typeof serializeFlowOverview>[]} */
    const flows = [];

    for (const flow of flowsToProcess) {
        const id = String(/** @type {{ id: string }} */ (flow).id);
        let steps = [];
        if (includeActions) {
            try {
                steps = await fetchFlowActionsForFlow(apiKey.trim(), id);
            } catch (e) {
                steps = [
                    {
                        id: "error",
                        type: "error",
                        status: null,
                        messages: [],
                        error: e.message,
                    },
                ];
            }
            await sleep(RATE_LIMIT_DELAY_MS);
        }
        flows.push(serializeFlowOverview(flow, steps));
    }

    return {
        readOnly: true,
        includeActions,
        maxFlows,
        statusFilter: status,
        generatedAt: new Date().toISOString(),
        truncated: flowsTruncated || flowRows.length > maxFlows,
        summary: {
            total: flows.length,
            live: flows.filter((f) => f.status === "live").length,
            draft: flows.filter((f) => f.status === "draft").length,
            manual: flows.filter((f) => f.status === "manual").length,
            totalEmailSteps: flows.reduce((s, f) => s + f.emailStepCount, 0),
        },
        flows,
    };
}
