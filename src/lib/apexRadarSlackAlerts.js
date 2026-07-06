import { APEX_RADAR_ALERT_TYPE_LABELS } from "@/lib/apexRadarMonitorAlerts";

function severityEmoji(severity) {
    if (severity === "critical") return ":red_circle:";
    if (severity === "warning") return ":warning:";
    return ":large_blue_circle:";
}

/** Customer name with optional FB / Google Ads account ids for Slack. */
export function formatApexRadarAlertCustomerLabel(alert) {
    const name = alert?.customerName || "Unnamed customer";
    const idParts = [];
    const fb = String(alert?.facebookAdAccountId || "").trim();
    const gads = String(alert?.googleAdsCustomerId || "").trim();
    if (fb) idParts.push(`FB \`${fb}\``);
    if (gads) idParts.push(`GAds \`${gads}\``);
    if (!idParts.length) return `*${name}*`;
    return `*${name}* · ${idParts.join(" · ")}`;
}

/**
 * Build Slack message payload mirroring the Active warnings panel (customer, type, title, message, team).
 * @param {{ alerts: object[], platformLabel: string }} input
 */
export function formatApexRadarActiveWarningsSlackMessage({ alerts = [], platformLabel = "Apex Radar" }) {
    const list = Array.isArray(alerts) ? alerts : [];
    const count = list.length;
    const countLabel = `${count} active warning${count === 1 ? "" : "s"}`;
    const fallbackText =
        count === 0
            ? `Active warnings — ${platformLabel}: ${countLabel}`
            : `Active warnings — ${platformLabel}: ${countLabel}`;

    /** @type {import('@slack/web-api').KnownBlock[]} */
    const blocks = [
        {
            type: "header",
            text: { type: "plain_text", text: "Active warnings", emoji: true },
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `*${platformLabel}* · ${countLabel}`,
                },
            ],
        },
    ];

    if (count === 0) {
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: "No active warnings for the current filters.",
            },
        });
        return { text: fallbackText, blocks };
    }

    blocks.push({ type: "divider" });

    for (const alert of list) {
        const typeLabel = APEX_RADAR_ALERT_TYPE_LABELS[alert.type] || alert.title || "Alert";
        const team = alert.teamMemberNames?.length
            ? alert.teamMemberNames.join(", ")
            : "—";

        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: [
                    `${severityEmoji(alert.severity)} ${formatApexRadarAlertCustomerLabel(alert)} · \`${typeLabel}\``,
                    `*${alert.title}*`,
                    alert.message,
                    `*Team:* ${team}`,
                ].join("\n"),
            },
        });
    }

    return { text: fallbackText, blocks };
}

function formatAlertSummaryLine(alert) {
    const typeLabel = APEX_RADAR_ALERT_TYPE_LABELS[alert.type] || alert.title || "Alert";
    return `• ${formatApexRadarAlertCustomerLabel(alert)} · ${typeLabel} — ${alert.title}`;
}

/**
 * Delivery summary posted to the platform workspace channel after DM batch
 * (PS → #apex-radar-workspace-ps, Google Ads → #apex-radar-workspace).
 * @param {{
 *   platformLabel: string,
 *   sentAt: Date,
 *   deliveries: { name: string, alertCount: number, alerts: object[] }[],
 *   skipped: { name: string, reason: string }[],
 *   unassignedAlertCount: number,
 *   totalAlertCount: number,
 * }} input
 */
export function formatApexRadarDmDeliverySummarySlackMessage({
    platformLabel = "Apex Radar",
    sentAt = new Date(),
    deliveries = [],
    skipped = [],
    unassignedAlertCount = 0,
    totalAlertCount = 0,
}) {
    const dateLabel = sentAt.toLocaleString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Copenhagen",
    });

    const dmSentCount = deliveries.length;
    const summaryParts = [
        `*${dmSentCount}* user${dmSentCount === 1 ? "" : "s"} notified`,
        `*${totalAlertCount}* warning${totalAlertCount === 1 ? "" : "s"} total`,
    ];
    if (skipped.length) {
        summaryParts.push(`*${skipped.length}* skipped`);
    }
    if (unassignedAlertCount) {
        summaryParts.push(`*${unassignedAlertCount}* unassigned`);
    }

    const fallbackText = `Apex Radar DM summary — ${platformLabel} — ${dateLabel}`;

    /** @type {import('@slack/web-api').KnownBlock[]} */
    const blocks = [
        {
            type: "header",
            text: { type: "plain_text", text: "DM delivery summary", emoji: true },
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `*${platformLabel}* · ${dateLabel}`,
                },
            ],
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: summaryParts.join(" · "),
            },
        },
    ];

    if (dmSentCount === 0 && skipped.length === 0 && unassignedAlertCount === 0) {
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: "No assignees with Slack IDs were found for the current warnings.",
            },
        });
        return { text: fallbackText, blocks };
    }

    for (let i = 0; i < deliveries.length; i++) {
        const d = deliveries[i];
        if (i > 0) {
            blocks.push({ type: "divider" });
        }
        const lines = (d.alerts || []).map(formatAlertSummaryLine);
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: [`*${d.name}* — ${d.alertCount} alert${d.alertCount === 1 ? "" : "s"}`, ...lines].join(
                    "\n"
                ),
            },
        });
    }

    if (skipped.length) {
        blocks.push({ type: "divider" });
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: [
                    "*Could not DM*",
                    ...skipped.map((s) => `• ${s.name} — ${s.reason}`),
                ].join("\n"),
            },
        });
    }

    if (unassignedAlertCount > 0) {
        blocks.push({ type: "divider" });
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*${unassignedAlertCount}* warning${unassignedAlertCount === 1 ? "" : "s"} had no assigned team members.`,
            },
        });
    }

    return { text: fallbackText, blocks };
}
