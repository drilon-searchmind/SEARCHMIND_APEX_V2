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
    // Slack rejects raw_text with length 0 (empty first header cell was failing send).
    return { type: "raw_text", text: s.length > 0 ? s : "\u00a0" };
}

function slackTable(bodyRows) {
    const header = ["", "Seneste 7 dage", "vs. forrige 7", "Seneste 14 dage", "vs. forrige 14"];
    return {
        type: "table",
        column_settings: [
            { align: "left", is_wrapped: true },
            { align: "right" },
            { align: "right" },
            { align: "right" },
            { align: "right" },
        ],
        rows: [header.map(rawCell), ...bodyRows.map((row) => row.map(rawCell))],
    };
}

function tableRow(label, v7, d7, v14, d14) {
    return [label, v7, d7, v14, d14];
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

function recLines(recs) {
    if (!recs?.length) return [];
    const lines = [":dart: *3 anbefalinger*"];
    recs.slice(0, 3).forEach((rec, i) => lines.push(`${i + 1}. ${rec}`));
    return lines;
}

function metaTable(meta, currency) {
    const w7 = meta.last7;
    const w14 = meta.last14;
    const type = meta.accountType || "ecommerce";
    const spendPct7 = w7.vsPrev?.spend;
    const spendPct14 = w14.vsPrev?.spend;
    const rows = [
        tableRow(
            "Spend",
            fmtMoney(w7.spend, currency),
            deltaCell("spend", w7.vsPrev?.spend),
            fmtMoney(w14.spend, currency),
            deltaCell("spend", w14.vsPrev?.spend)
        ),
    ];

    if (type === "lead") {
        rows.push(
            tableRow(
                "Leads",
                fmtDk(w7.leads, 0),
                deltaCell("leads", w7.vsPrev?.leads),
                fmtDk(w14.leads, 0),
                deltaCell("leads", w14.vsPrev?.leads)
            ),
            tableRow(
                "Pris per lead",
                fmtMoney(w7.cpl, currency),
                deltaCell("cpl", w7.vsPrev?.cpl),
                fmtMoney(w14.cpl, currency),
                deltaCell("cpl", w14.vsPrev?.cpl)
            )
        );
    } else if (type === "brand") {
        rows.push(
            tableRow(
                "LP-visninger",
                fmtDk(w7.landingPageViews, 0),
                deltaCell("conversions", w7.vsPrev?.conversions),
                fmtDk(w14.landingPageViews, 0),
                deltaCell("conversions", w14.vsPrev?.conversions)
            ),
            tableRow(
                "CPC",
                fmtMoney(w7.cpc, currency),
                deltaCell("cpa", w7.vsPrev?.cpa),
                fmtMoney(w14.cpc, currency),
                deltaCell("cpa", w14.vsPrev?.cpa)
            ),
            tableRow(
                "CTR",
                `${fmtDk(w7.ctr, 2)} %`,
                deltaCell("conversions", w7.vsPrev?.conversions),
                `${fmtDk(w14.ctr, 2)} %`,
                deltaCell("conversions", w14.vsPrev?.conversions)
            )
        );
    } else {
        rows.push(
            tableRow(
                "Omsætning",
                fmtMoney(w7.revenue, currency),
                deltaCell("revenue", w7.vsPrev?.revenue, { spendPct: spendPct7 }),
                fmtMoney(w14.revenue, currency),
                deltaCell("revenue", w14.vsPrev?.revenue, { spendPct: spendPct14 })
            ),
            tableRow(
                "ROAS",
                fmtDk(w7.roas, 2),
                deltaCell("roas", w7.vsPrev?.roas),
                fmtDk(w14.roas, 2),
                deltaCell("roas", w14.vsPrev?.roas)
            ),
            tableRow(
                "Køb",
                fmtDk(w7.conversions, 0),
                deltaCell("conversions", w7.vsPrev?.conversions),
                fmtDk(w14.conversions, 0),
                deltaCell("conversions", w14.vsPrev?.conversions)
            ),
            tableRow(
                "CPA",
                fmtMoney(w7.cpa, currency),
                deltaCell("cpa", w7.vsPrev?.cpa),
                fmtMoney(w14.cpa, currency),
                deltaCell("cpa", w14.vsPrev?.cpa)
            )
        );
    }

    rows.push(
        tableRow(
            "Frekvens",
            fmtDk(w7.frequency, 2),
            deltaCell("frequency", w7.vsPrev?.frequency, { current: w7.frequency }),
            fmtDk(w14.frequency, 2),
            deltaCell("frequency", w14.vsPrev?.frequency, { current: w14.frequency })
        )
    );
    return slackTable(rows);
}

function googleTable(google, currency) {
    const w7 = google.last7;
    const w14 = google.last14;
    const spendPct7 = w7.vsPrev?.spend;
    const spendPct14 = w14.vsPrev?.spend;
    return slackTable([
        tableRow(
            "Spend",
            fmtMoney(w7.spend, currency),
            deltaCell("spend", w7.vsPrev?.spend),
            fmtMoney(w14.spend, currency),
            deltaCell("spend", w14.vsPrev?.spend)
        ),
        tableRow(
            "Omsætning",
            fmtMoney(w7.revenue, currency),
            deltaCell("revenue", w7.vsPrev?.revenue, { spendPct: spendPct7 }),
            fmtMoney(w14.revenue, currency),
            deltaCell("revenue", w14.vsPrev?.revenue, { spendPct: spendPct14 })
        ),
        tableRow(
            "ROAS",
            fmtDk(w7.roas, 2),
            deltaCell("roas", w7.vsPrev?.roas),
            fmtDk(w14.roas, 2),
            deltaCell("roas", w14.vsPrev?.roas)
        ),
        tableRow(
            "Konverteringer",
            fmtDk(w7.conversions, 1),
            deltaCell("conversions", w7.vsPrev?.conversions),
            fmtDk(w14.conversions, 1),
            deltaCell("conversions", w14.vsPrev?.conversions)
        ),
        tableRow(
            "CPA",
            fmtMoney(w7.cpa, currency),
            deltaCell("cpa", w7.vsPrev?.cpa),
            fmtMoney(w14.cpa, currency),
            deltaCell("cpa", w14.vsPrev?.cpa)
        ),
    ]);
}

/**
 * Format the Performance Brief as Slack Block Kit. Safe for client import.
 */
export function formatPerformanceBriefSlack({ compact, narrative, channelName }) {
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
            ? "Se kanalerne hver for sig — Meta og Google måler omsætning forskelligt."
            : metaOk
              ? "Meta-brief for de seneste 7 dage."
              : googleOk
                ? "Google Ads-brief for de seneste 7 dage."
                : "Ingen aktive kanaler i denne uge.");

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
                    text: `Performance Brief · would post to ${dest}`,
                },
            ],
        },
    ];

    const intro = [
        `*${customerName} · uge ${week}*`,
        `Samlet mediespend ${fmtMoney(totalSpend, currency)} de seneste 7 dage. ${headline}`,
    ];
    pushSection(blocks, intro);

    if (metaOk) {
        blocks.push({ type: "divider" });
        const light = lightToken(narrative?.meta?.light || channelLight(compact.meta.last7));
        const summary = narrative?.meta?.summary || "Meta-nøgletal for de seneste 7 og 14 dage.";
        pushSection(blocks, [`${light} *Meta*`, summary]);
        blocks.push(metaTable(compact.meta, currency));
        pushSection(blocks, [
            ...rankedLines("Annoncetyper, seneste 7 dage", compact.meta.adTypes, "køb"),
            "",
            ...recLines(narrative?.meta?.recommendations),
        ]);
    } else if (compact?.meta?.skipReason) {
        blocks.push({ type: "divider" });
        pushSection(blocks, [
            ":white_circle: *Meta*",
            "Meta er ikke konfigureret for denne kunde.",
        ]);
    } else if (compact?.meta?.error) {
        blocks.push({ type: "divider" });
        pushSection(blocks, [":red_circle: *Meta*", `Kunne ikke hente Meta-data: ${compact.meta.error}`]);
    }

    if (googleOk) {
        blocks.push({ type: "divider" });
        const light = lightToken(narrative?.google?.light || channelLight(compact.google.last7));
        const summary = narrative?.google?.summary || "Google Ads-nøgletal for de seneste 7 og 14 dage.";
        pushSection(blocks, [`${light} *Google Ads*`, summary]);
        blocks.push(googleTable(compact.google, currency));
        pushSection(blocks, [
            ...rankedLines("Kampagnetyper, seneste 7 dage", compact.google.campaignTypes, "konv."),
            "",
            ...recLines(narrative?.google?.recommendations),
        ]);
    } else if (compact?.google?.skipReason) {
        blocks.push({ type: "divider" });
        pushSection(blocks, [
            ":white_circle: *Google Ads*",
            "Google Ads er ikke konfigureret for denne kunde.",
        ]);
    } else if (compact?.google?.error) {
        blocks.push({ type: "divider" });
        pushSection(blocks, [
            ":red_circle: *Google Ads*",
            `Kunne ikke hente Google Ads-data: ${compact.google.error}`,
        ]);
    }

    if (metaOk && googleOk) {
        blocks.push({
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: "_Meta og Google måler omsætning forskelligt og kan ikke lægges sammen._",
                },
            ],
        });
    }

    return { text: fallbackText, blocks };
}
