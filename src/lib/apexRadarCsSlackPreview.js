import {
    APEX_RADAR_CS_KPI_LABELS,
    APEX_RADAR_CS_PERIOD_LABELS,
    APEX_RADAR_CS_PLATFORM_LABELS,
} from "@/lib/apexRadarCsConstants";

function severityEmoji(severity) {
    if (severity === "critical") return ":red_circle:";
    if (severity === "warning") return ":warning:";
    return ":large_blue_circle:";
}

function fmtPct(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}%`;
}

/**
 * Format CS alerts as Slack Block Kit. Does not send. Safe for client import.
 * @param {{ alerts: object[], customerName: string, channelName?: string }} input
 */
export function formatApexRadarCsSlackPreview({ alerts = [], customerName, channelName }) {
    const list = Array.isArray(alerts) ? alerts : [];
    const dest = channelName ? `#${String(channelName).replace(/^#/, "")}` : "unassigned channel";
    const countLabel = `${list.length} CS alert${list.length === 1 ? "" : "s"}`;
    const fallbackText =
        list.length === 0
            ? `CS alerts — ${customerName || "Customer"}: none would fire`
            : `CS alerts — ${customerName || "Customer"}: ${countLabel}`;

    const blocks = [
        {
            type: "header",
            text: { type: "plain_text", text: "CS alerts", emoji: true },
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `*${customerName || "Customer"}* · ${countLabel} · would post to ${dest}`,
                },
            ],
        },
    ];

    if (list.length === 0) {
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: "No CS alerts would fire for the current rules.",
            },
        });
        return { text: fallbackText, blocks };
    }

    blocks.push({ type: "divider" });

    for (const alert of list) {
        const platformLabel =
            alert.platformLabel || APEX_RADAR_CS_PLATFORM_LABELS[alert.platform] || alert.platform;
        const kpiLabel = alert.kpiLabel || APEX_RADAR_CS_KPI_LABELS[alert.kpi] || alert.kpi;
        const periodLabel = alert.periodLabel || APEX_RADAR_CS_PERIOD_LABELS[alert.period] || alert.period;
        blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: [
                    `${severityEmoji(alert.severity)} *${alert.customerName || customerName}* · \`${platformLabel}\` · \`${kpiLabel}\``,
                    `*${alert.title || `${kpiLabel} ${periodLabel} drop`}*`,
                    alert.message || `${kpiLabel} dropped ${fmtPct(alert.pctChange)}.`,
                    `*Window:* ${periodLabel}${alert.currentWindow ? ` (${alert.currentWindow} vs ${alert.priorWindow || "prior"})` : ""}`,
                ].join("\n"),
            },
        });
    }

    return { text: fallbackText, blocks };
}
