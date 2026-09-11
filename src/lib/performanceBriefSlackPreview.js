import {
    SLACK_LIGHT,
    SLACK_LIGHT_EMOJI,
    performanceBriefCustomerSettingsUrl,
} from "@/lib/performanceBriefConstants";
import { channelLight, metricLight } from "@/lib/performanceBriefLights";
import {
    formatTypeLine,
    getPrimaryMetaLeadActionType,
    num,
    rankTypes,
} from "@/lib/performanceBriefIntent";

function fmtDk(n, digits = 0) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return new Intl.NumberFormat("da-DK", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(Number(n));
}

function moneySuffix(currency) {
    const code = String(currency || "DKK").toUpperCase();
    return code === "DKK" ? " kr" : ` ${code}`;
}

function fmtMoney(n, currency) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    const abs = Math.abs(Number(n));
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return `${fmtDk(n, digits)}${moneySuffix(currency)}`;
}

function fmtPct(pct) {
    if (pct == null || !Number.isFinite(Number(pct))) return "—";
    const v = Number(pct);
    const sign = v > 0 ? "+" : "";
    return `${sign}${fmtDk(v, 0)} %`;
}

function lightToken(kind) {
    return SLACK_LIGHT[kind] || SLACK_LIGHT.yellow;
}

function lightEmoji(kind) {
    return SLACK_LIGHT_EMOJI[kind] || SLACK_LIGHT_EMOJI.yellow;
}

function deltaCell(metric, pct, extra) {
    const kind = metricLight(metric, pct, extra);
    if (pct == null || !Number.isFinite(Number(pct))) return `${lightEmoji("yellow")} —`;
    return `${lightEmoji(kind)} ${fmtPct(pct)}`;
}

function rawCell(text) {
    const s = String(text ?? "");
    return { type: "raw_text", text: s.length > 0 ? s : "\u00a0" };
}

function slackTable(bodyRows, header) {
    return {
        type: "table",
        column_settings: header.map((_, i) => ({
            align: i === 0 ? "left" : "right",
            is_wrapped: i === 0,
        })),
        rows: [header.map(rawCell), ...bodyRows.map((row) => row.map(rawCell))],
    };
}

function pushSection(blocks, lines) {
    const text = lines.filter(Boolean).join("\n").trim();
    if (!text) return;
    const chunks = [];
    if (text.length <= 2900) {
        chunks.push(text);
    } else {
        let buf = "";
        for (const line of text.split("\n")) {
            if ((buf + "\n" + line).length > 2900) {
                chunks.push(buf);
                buf = line;
            } else {
                buf = buf ? `${buf}\n${line}` : line;
            }
        }
        if (buf) chunks.push(buf);
    }
    for (const chunk of chunks) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: chunk } });
    }
}

function rankedLines(title, rows, intent, options = {}) {
    if (!rows?.length) return [];
    const totalSpend = rows.reduce((s, r) => s + num(r.spend), 0);
    const { rows: sorted, label } = rankTypes(rows, intent, options);
    const lines = [`:trophy: *${title}* (${label})`];
    sorted.slice(0, 6).forEach((row, i) => {
        lines.push(`${i + 1}. ${formatTypeLine(row, intent, totalSpend)}`);
    });
    return lines;
}

function optimizationLines(optimizations) {
    if (!optimizations?.length) return [];
    const lines = [":fire: *Top 3 optimeringsmuligheder* (tværs kanaler)"];
    optimizations.slice(0, 3).forEach((rec, i) => lines.push(`${i + 1}. ${rec}`));
    return lines;
}

function cellValue(active, formatter, windowData) {
    if (!active || !windowData) return "—";
    return formatter(windowData);
}

function pivotRow(label, metaVal, metaDelta, googleVal, googleDelta) {
    return [label, metaVal, metaDelta, googleVal, googleDelta];
}

/**
 * Unified KPI table: Meta + Google columns, 7d vs previous 7d only.
 */
function combinedKpiTable(compact, currency) {
    const metaOk = compact?.meta?.configured && !compact?.meta?.error;
    const googleOk = compact?.google?.configured && !compact?.google?.error;
    const m7 = compact?.meta?.last7;
    const g7 = compact?.google?.last7;
    const metaIntent = compact?.accountIntent?.meta;
    const googleIntent = compact?.accountIntent?.google;
    const metaType = compact?.meta?.accountType || "ecommerce";
    const businessCategory = compact?.customer?.businessCategory || "ecommerce";
    const isEcommerceCustomer = businessCategory === "ecommerce";
    const isB2bCustomer = businessCategory === "b2b";

    const header = ["KPI", "Meta (7d)", "Meta Δ", "Google (7d)", "Google Δ"];

    const rows = [
        pivotRow(
            "Spend",
            cellValue(metaOk, (w) => fmtMoney(w.spend, currency), m7),
            metaOk ? deltaCell("spend", m7?.vsPrev?.spend) : "—",
            cellValue(googleOk, (w) => fmtMoney(w.spend, currency), g7),
            googleOk ? deltaCell("spend", g7?.vsPrev?.spend) : "—"
        ),
    ];

    let metaLeadKpi = false;
    let googleLeadKpi = false;
    let metaRoasKpi = false;
    let googleRoasKpi = false;

    if (isB2bCustomer) {
        metaLeadKpi = metaOk;
        googleLeadKpi = googleOk;
    } else {
        metaLeadKpi = metaIntent?.primaryKpi === "CPA";
        googleLeadKpi = googleIntent?.primaryKpi === "CPA";
        metaRoasKpi =
            metaIntent?.primaryKpi === "ROAS" ||
            (num(m7?.revenue) > 0 && metaIntent?.primaryKpi !== "CPA");
        googleRoasKpi =
            googleIntent?.primaryKpi === "ROAS" ||
            (num(g7?.revenue) > 0 && googleIntent?.primaryKpi !== "CPA");

        if (metaRoasKpi && metaLeadKpi && num(m7?.revenue) > 0) metaLeadKpi = false;
        if (googleRoasKpi && googleLeadKpi && num(g7?.revenue) > 0) googleLeadKpi = false;
    }

    if (metaRoasKpi || googleRoasKpi) {
        rows.push(
            pivotRow(
                "Omsætning",
                metaRoasKpi ? cellValue(metaOk, (w) => fmtMoney(w.revenue, currency), m7) : "—",
                metaRoasKpi
                    ? deltaCell("revenue", m7?.vsPrev?.revenue, { spendPct: m7?.vsPrev?.spend })
                    : "—",
                googleRoasKpi ? cellValue(googleOk, (w) => fmtMoney(w.revenue, currency), g7) : "—",
                googleRoasKpi
                    ? deltaCell("revenue", g7?.vsPrev?.revenue, { spendPct: g7?.vsPrev?.spend })
                    : "—"
            ),
            pivotRow(
                "ROAS",
                metaRoasKpi ? cellValue(metaOk, (w) => fmtDk(w.roas, 2), m7) : "—",
                metaRoasKpi ? deltaCell("roas", m7?.vsPrev?.roas) : "—",
                googleRoasKpi ? cellValue(googleOk, (w) => fmtDk(w.roas, 2), g7) : "—",
                googleRoasKpi ? deltaCell("roas", g7?.vsPrev?.roas) : "—"
            )
        );
    }

    if (metaLeadKpi || googleLeadKpi) {
        rows.push(
            pivotRow(
                "Leads",
                metaLeadKpi ? fmtDk(m7?.leads ?? m7?.conversions, 0) : "—",
                metaLeadKpi ? deltaCell("leads", m7?.vsPrev?.leads ?? m7?.vsPrev?.conversions) : "—",
                googleLeadKpi ? fmtDk(g7?.conversions, 0) : "—",
                googleLeadKpi ? deltaCell("conversions", g7?.vsPrev?.conversions) : "—"
            ),
            pivotRow(
                "Pris per lead / CPA",
                metaLeadKpi ? fmtMoney(m7?.cpl ?? m7?.cpa, currency) : "—",
                metaLeadKpi ? deltaCell("cpl", m7?.vsPrev?.cpl ?? m7?.vsPrev?.cpa) : "—",
                googleLeadKpi ? fmtMoney(g7?.cpa, currency) : "—",
                googleLeadKpi ? deltaCell("cpa", g7?.vsPrev?.cpa) : "—"
            )
        );
    }

    if (!metaRoasKpi && !googleRoasKpi && !metaLeadKpi && !googleLeadKpi) {
        rows.push(
            pivotRow(
                metaType === "brand" ? "LP-visninger" : "Konverteringer",
                cellValue(
                    metaOk,
                    (w) => fmtDk(metaType === "brand" ? w.landingPageViews : w.conversions, 0),
                    m7
                ),
                metaOk ? deltaCell("conversions", m7?.vsPrev?.conversions) : "—",
                cellValue(googleOk, (w) => fmtDk(w.conversions, 1), g7),
                googleOk ? deltaCell("conversions", g7?.vsPrev?.conversions) : "—"
            )
        );
    } else if ((metaRoasKpi || googleRoasKpi) && !isB2bCustomer) {
        rows.push(
            pivotRow(
                metaType === "brand" ? "LP-visninger" : "Konverteringer",
                metaRoasKpi
                    ? cellValue(
                          metaOk,
                          (w) =>
                              fmtDk(metaType === "brand" ? w.landingPageViews : w.conversions, 0),
                          m7
                      )
                    : "—",
                metaRoasKpi ? deltaCell("conversions", m7?.vsPrev?.conversions) : "—",
                googleRoasKpi ? cellValue(googleOk, (w) => fmtDk(w.conversions, 1), g7) : "—",
                googleRoasKpi ? deltaCell("conversions", g7?.vsPrev?.conversions) : "—"
            )
        );
    }

    if (metaOk) {
        rows.push(
            pivotRow(
                "Frekvens (Meta)",
                fmtDk(m7.frequency, 2),
                deltaCell("frequency", m7.vsPrev?.frequency, { current: m7.frequency }),
                "—",
                "—"
            )
        );
    }

    return slackTable(rows, header);
}

function periodLabel(windows) {
    const last7 = windows?.last7;
    if (!last7?.start || !last7?.end) return "";
    return `${last7.start} – ${last7.end} (slutter i går)`;
}

/**
 * Format the Performance Brief as Slack Block Kit. Safe for client import.
 */
export function formatPerformanceBriefSlack({
    compact,
    narrative,
    channelName,
    optimizations,
    preview = false,
    customerId,
}) {
    const customerName = compact?.customer?.customerName || "Customer";
    const currency = compact?.customer?.currency || "DKK";
    const week = compact?.windows?.isoWeek;
    const dest = channelName ? `#${String(channelName).replace(/^#/, "")}` : "unassigned channel";
    const resolvedCustomerId = customerId || compact?.customer?.customerId || "";
    const settingsUrl = performanceBriefCustomerSettingsUrl(resolvedCustomerId);
    const metaOk = compact?.meta?.configured && !compact?.meta?.error;
    const googleOk = compact?.google?.configured && !compact?.google?.error;

    const totalSpend =
        (metaOk ? Number(compact.meta.last7?.spend || 0) : 0) +
        (googleOk ? Number(compact.google.last7?.spend || 0) : 0);

    const headline =
        narrative?.headlineSentence ||
        (metaOk && googleOk
            ? "Se kanalerne side om side — Meta og Google måler omsætning forskelligt."
            : metaOk
              ? "Meta-brief for de seneste 7 dage."
              : googleOk
                ? "Google Ads-brief for de seneste 7 dage."
                : "Ingen aktive kanaler i denne uge.");

    const topOpts =
        narrative?.topOptimizations?.length > 0
            ? narrative.topOptimizations
            : optimizations || [];

    const fallbackText = `${customerName} · uge ${week} — Performance Brief`;
    const period = periodLabel(compact?.windows);
    const contextLine = preview
        ? `Performance Brief · ${period} · would post to ${dest}`
        : period
          ? `Performance Brief · ${period}`
          : "Performance Brief";

    const blocks = [
        {
            type: "context",
            elements: [{ type: "mrkdwn", text: contextLine }],
        },
    ];

    const intro = [
        `*${customerName} · uge ${week}*`,
        `Samlet mediespend ${fmtMoney(totalSpend, currency)} de seneste 7 dage. ${headline}`,
    ];
    pushSection(blocks, intro);

    if (metaOk || googleOk) {
        blocks.push({ type: "divider" });
        const metaLight = metaOk
            ? lightToken(narrative?.meta?.light || channelLight(compact.meta.last7))
            : ":white_circle:";
        const googleLight = googleOk
            ? lightToken(narrative?.google?.light || channelLight(compact.google.last7))
            : ":white_circle:";
        const summaries = [];
        if (metaOk && narrative?.meta?.summary) summaries.push(`${metaLight} *Meta:* ${narrative.meta.summary}`);
        if (googleOk && narrative?.google?.summary)
            summaries.push(`${googleLight} *Google:* ${narrative.google.summary}`);
        if (summaries.length) pushSection(blocks, summaries);
        blocks.push(combinedKpiTable(compact, currency));
    }

    pushSection(blocks, optimizationLines(topOpts));

    if (metaOk) {
        pushSection(blocks, [
            "",
            ...rankedLines(
                "Meta annoncetyper, seneste 7 dage",
                compact.meta.adTypes,
                compact.accountIntent?.meta,
                {
                    platform: "meta",
                    businessCategory: compact.customer?.businessCategory,
                    metaPrimaryLeadType: getPrimaryMetaLeadActionType(compact.meta?.last7?.actions),
                }
            ),
        ]);
    } else if (compact?.meta?.skipReason) {
        pushSection(blocks, [":white_circle: *Meta* — ikke konfigureret"]);
    } else if (compact?.meta?.error) {
        pushSection(blocks, [":red_circle: *Meta*", `Kunne ikke hente data: ${compact.meta.error}`]);
    }

    if (googleOk) {
        pushSection(blocks, [
            "",
            ...rankedLines(
                "Google kampagnetyper, seneste 7 dage",
                compact.google.campaignTypes,
                compact.accountIntent?.google,
                {
                    platform: "google",
                    businessCategory: compact.customer?.businessCategory,
                }
            ),
        ]);
    } else if (compact?.google?.skipReason) {
        pushSection(blocks, [":white_circle: *Google Ads* — ikke konfigureret"]);
    } else if (compact?.google?.error) {
        pushSection(blocks, [
            ":red_circle: *Google Ads*",
            `Kunne ikke hente data: ${compact.google.error}`,
        ]);
    }

    if (settingsUrl) {
        blocks.push({
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `You can adjust your schedule timing for this customer here: ${settingsUrl}`,
                },
            ],
        });
    }

    return { text: fallbackText, blocks };
}
