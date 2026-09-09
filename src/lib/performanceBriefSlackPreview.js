import { SLACK_LIGHT, SLACK_LIGHT_EMOJI } from "@/lib/performanceBriefConstants";
import { channelLight, metricLight } from "@/lib/performanceBriefLights";

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

function rankedLines(title, rows, convLabel) {
    if (!rows?.length) return [];
    const lines = [`:trophy: *${title}* (rangeret på ROAS)`];
    rows.slice(0, 6).forEach((row, i) => {
        const conv =
            row.conversions == null
                ? ""
                : ` · ${fmtDk(row.conversions, Number.isInteger(row.conversions) ? 0 : 1)} ${convLabel}`;
        lines.push(
            `${i + 1}. ${row.type}: ROAS ${fmtDk(row.roas, 1)} · ${fmtDk(row.spendSharePct, 0)} % af spend${conv}`
        );
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
    const metaType = compact?.meta?.accountType || "ecommerce";

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

    if (metaType === "lead" && metaOk) {
        rows.push(
            pivotRow(
                "Leads",
                fmtDk(m7.leads, 0),
                deltaCell("leads", m7.vsPrev?.leads),
                googleOk ? fmtDk(g7.conversions, 0) : "—",
                googleOk ? deltaCell("conversions", g7.vsPrev?.conversions) : "—"
            ),
            pivotRow(
                "Pris per lead / CPA",
                fmtMoney(m7.cpl, currency),
                deltaCell("cpl", m7.vsPrev?.cpl),
                googleOk ? fmtMoney(g7.cpa, currency) : "—",
                googleOk ? deltaCell("cpa", g7.vsPrev?.cpa) : "—"
            )
        );
    } else {
        rows.push(
            pivotRow(
                "Omsætning",
                cellValue(metaOk, (w) => fmtMoney(w.revenue, currency), m7),
                metaOk
                    ? deltaCell("revenue", m7.vsPrev?.revenue, { spendPct: m7.vsPrev?.spend })
                    : "—",
                cellValue(googleOk, (w) => fmtMoney(w.revenue, currency), g7),
                googleOk
                    ? deltaCell("revenue", g7.vsPrev?.revenue, { spendPct: g7.vsPrev?.spend })
                    : "—"
            ),
            pivotRow(
                "ROAS",
                cellValue(metaOk, (w) => fmtDk(w.roas, 2), m7),
                metaOk ? deltaCell("roas", m7.vsPrev?.roas) : "—",
                cellValue(googleOk, (w) => fmtDk(w.roas, 2), g7),
                googleOk ? deltaCell("roas", g7.vsPrev?.roas) : "—"
            ),
            pivotRow(
                metaType === "brand" ? "LP-visninger" : "Konverteringer",
                cellValue(
                    metaOk,
                    (w) => fmtDk(metaType === "brand" ? w.landingPageViews : w.conversions, 0),
                    m7
                ),
                metaOk ? deltaCell("conversions", m7.vsPrev?.conversions) : "—",
                cellValue(googleOk, (w) => fmtDk(w.conversions, 1), g7),
                googleOk ? deltaCell("conversions", g7.vsPrev?.conversions) : "—"
            ),
            pivotRow(
                "CPA",
                cellValue(metaOk, (w) => fmtMoney(w.cpa, currency), m7),
                metaOk ? deltaCell("cpa", m7.vsPrev?.cpa) : "—",
                cellValue(googleOk, (w) => fmtMoney(w.cpa, currency), g7),
                googleOk ? deltaCell("cpa", g7.vsPrev?.cpa) : "—"
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
export function formatPerformanceBriefSlack({ compact, narrative, channelName, optimizations }) {
    const customerName = compact?.customer?.customerName || "Customer";
    const currency = compact?.customer?.currency || "DKK";
    const week = compact?.windows?.isoWeek;
    const dest = channelName ? `#${String(channelName).replace(/^#/, "")}` : "unassigned channel";
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
    const blocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: `${customerName} · uge ${week}`.slice(0, 150),
                emoji: true,
            },
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `Performance Brief · ${periodLabel(compact?.windows)} · would post to ${dest}`,
                },
            ],
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
            ...rankedLines("Meta annoncetyper, seneste 7 dage", compact.meta.adTypes, "køb"),
        ]);
    } else if (compact?.meta?.skipReason) {
        pushSection(blocks, [":white_circle: *Meta* — ikke konfigureret"]);
    } else if (compact?.meta?.error) {
        pushSection(blocks, [":red_circle: *Meta*", `Kunne ikke hente data: ${compact.meta.error}`]);
    }

    if (googleOk) {
        pushSection(blocks, [
            "",
            ...rankedLines("Google kampagnetyper, seneste 7 dage", compact.google.campaignTypes, "konv."),
        ]);
    } else if (compact?.google?.skipReason) {
        pushSection(blocks, [":white_circle: *Google Ads* — ikke konfigureret"]);
    } else if (compact?.google?.error) {
        pushSection(blocks, [
            ":red_circle: *Google Ads*",
            `Kunne ikke hente data: ${compact.google.error}`,
        ]);
    }

    if (metaOk && googleOk) {
        blocks.push({
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "_Google spend via samme API som Apex overview. Meta/Google omsætning må ikke lægges sammen._",
                },
            ],
        });
    }

    return { text: fallbackText, blocks };
}
