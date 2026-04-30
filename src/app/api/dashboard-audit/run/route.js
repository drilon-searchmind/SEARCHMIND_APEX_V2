import { NextResponse } from "next/server";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { getServerSession } from "next-auth";
import OpenAI from "openai";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getCustomerById } from "@root/lib/customerOperations";
import { normalizeAuditReport } from "@/lib/channelAuditReport";
import {
    AUDITABLE_SERVICE_IDS,
    getConfiguredAuditServices,
} from "@/lib/customerServiceIntegrations";
import CustomerChannelAudit from "@/models/CustomerChannelAudit";

const openai =
    typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.trim()
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() })
        : null;

/**
 * Normalize model output into JSON (handles optional ```json fences).
 * @param {string} raw
 */
function parseJsonLoose(raw) {
    const s = String(raw || "").trim();
    const unfenced = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    return JSON.parse(unfenced);
}

/** Optional Claude Ads repo (vendored) — inject methodology excerpt into prompts when present. */
function loadAdsAuditSkillExcerpt(maxLen = 8000) {
    try {
        const p = path.join(
            process.cwd(),
            "claude-ads-repo",
            "claude-ads",
            "skills",
            "ads-audit",
            "SKILL.md"
        );
        if (!fs.existsSync(p)) return "";
        return fs.readFileSync(p, "utf8").trim().slice(0, maxLen);
    } catch {
        return "";
    }
}

function buildFallbackReport(customerName, services, startDate, endDate) {
    return {
        executiveSummary: `${customerName}: Automated audit scaffolding only — OpenAI unavailable. Configure OPENAI_API_KEY for full AI briefings.`,
        methodologyNote:
            "This placeholder follows the Apex audit layout. Saved audits and deeper data hooks will enrich this later.",
        channels: services.map((svc) => ({
            id: svc.id,
            label: svc.label,
            healthScore: null,
            grade: "—",
            summary: `${svc.label} was included for ${startDate}–${endDate}. Connect live metrics to score this channel.`,
            topPriorities: [
                {
                    title: `Review ${svc.label} performance for the selected period`,
                    severity: "medium",
                    rationale: "Baseline check until metrics are wired into audit generation.",
                    recommendedAction: "Compare spend, conversions, and efficiency vs prior period in the service dashboard.",
                },
            ],
        })),
        crossChannelNotes: [
            "Run this audit again after OPENAI_API_KEY is set for AI-generated priorities.",
        ],
    };
}

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        /** Internal users and admins; external customer accounts blocked unless admin. */
        if (session.user.isExternal === true && session.user.isAdmin !== true) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const {
            customerId,
            startDate,
            endDate,
            /** @type {string[]|undefined} */
            serviceIds,
            dataSnapshot = {},
        } = body;

        if (!customerId || !startDate || !endDate) {
            return NextResponse.json(
                { error: "customerId, startDate, and endDate are required" },
                { status: 400 }
            );
        }

        const ids = Array.isArray(serviceIds) ? serviceIds : [];
        if (ids.length === 0) {
            return NextResponse.json({ error: "Select at least one service" }, { status: 400 });
        }

        const customer = await getCustomerById(customerId);
        const plain = typeof customer.toObject === "function" ? customer.toObject() : customer;
        const settings = plain.CustomerSettings || {};
        const configured = getConfiguredAuditServices(settings);
        const allowed = new Set(configured.map((c) => c.id));

        for (const id of ids) {
            if (!AUDITABLE_SERVICE_IDS.includes(id) || !allowed.has(id)) {
                return NextResponse.json(
                    { error: `Service not allowed or not configured: ${id}` },
                    { status: 400 }
                );
            }
        }

        const services = configured.filter((c) => ids.includes(c.id));
        const customerName = plain.customerName || "Customer";

        let report;
        if (!openai) {
            report = buildFallbackReport(customerName, services, startDate, endDate);
        } else {
            const system = `You are a senior performance marketing lead. Produce a concise, objective multi-channel audit as strict JSON only (no markdown).
Use severity labels: critical, high, medium, low.
Each channel needs healthScore 0-100 (integer estimate from context if needed), grade A-F, summary string, and topPriorities array with 5-7 items (title, severity, rationale, recommendedAction).
Align with professional paid media audit practice: prioritize revenue impact, tracking integrity, waste, and scaling opportunities.
Output keys: executiveSummary (string), methodologyNote (string, one sentence), channels (array), crossChannelNotes (array of strings).
Each channel object: id, label, healthScore, grade, summary, topPriorities.
In executiveSummary: do NOT state any overall, mean, or aggregate numeric health score or letter grade for the account (those are computed from channel scores). Focus on channel-level themes, risks, and opportunities only.
JSON only.`;

            const skillExcerpt = loadAdsAuditSkillExcerpt();
            const userMsg = `Customer: ${customerName}
Date range: ${startDate} to ${endDate}
Channels to audit: ${services.map((s) => s.label).join(", ")}

Optional dashboard snapshot (may be partial):
${JSON.stringify(dataSnapshot, null, 2)}
${skillExcerpt ? `\n\nReference methodology (Claude Ads ads-audit skill excerpt):\n${skillExcerpt}\n` : ""}

Return the JSON report for these channels only.`;

            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    temperature: 0.35,
                    max_tokens: 4096,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userMsg },
                    ],
                });
                const raw = completion.choices[0]?.message?.content || "{}";
                report = parseJsonLoose(raw);
            } catch (e) {
                console.error("[dashboard-audit/run] OpenAI error", e);
                report = buildFallbackReport(customerName, services, startDate, endDate);
                report.methodologyNote =
                    (report.methodologyNote || "") +
                    " (AI generation failed; showing placeholder.)";
            }
        }

        normalizeAuditReport(report);

        await connectToDatabase();
        const createdByUserId =
            session.user?.id && mongoose.Types.ObjectId.isValid(String(session.user.id))
                ? new mongoose.Types.ObjectId(String(session.user.id))
                : null;

        const doc = await CustomerChannelAudit.create({
            customerId: plain._id,
            createdByUserId,
            dateRange: { startDate, endDate },
            serviceIds: ids,
            report,
            canonicalOverall: report.canonicalOverall || { score: null, grade: "—" },
            customerNameSnapshot: customerName,
        });

        const auditId = String(doc._id);

        return NextResponse.json({
            auditId,
            report,
            customerName,
            customerId: String(plain._id),
            dateRange: { startDate, endDate },
            services,
        });
    } catch (e) {
        console.error("[dashboard-audit/run]", e);
        const msg = e?.message === "Customer not found" ? "Customer not found" : "Audit failed";
        const status = e?.message === "Customer not found" ? 404 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}
