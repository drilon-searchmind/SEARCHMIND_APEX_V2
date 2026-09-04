import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import Customer from "@/models/Customer";
import ApexRadarCsCustomerSettings from "@/models/ApexRadarCsCustomerSettings";
import {
    APEX_RADAR_CS_DEFAULT_RULE_IDS,
    clampCsDropPct,
    isApexRadarCsCustomerId,
    isValidCsKpiForPlatform,
    isValidCsPeriod,
    isValidCsPlatform,
} from "@/lib/apexRadarCsConstants";
import { serializeCsSettings } from "@/lib/apexRadarCsRules";

function normalizeDefaultOverrides(raw) {
    if (!Array.isArray(raw)) return null;
    const byId = new Map();
    for (const row of raw) {
        const ruleId = String(row?.ruleId || "").trim();
        if (!APEX_RADAR_CS_DEFAULT_RULE_IDS.has(ruleId)) continue;
        byId.set(ruleId, {
            ruleId,
            enabled: row.enabled !== false,
            period: isValidCsPeriod(row.period) ? row.period : undefined,
            dropPct: row.dropPct != null && row.dropPct !== "" ? clampCsDropPct(row.dropPct) : undefined,
        });
    }
    return [...byId.values()];
}

function normalizeCustomRules(raw) {
    if (!Array.isArray(raw)) return null;
    const seen = new Set();
    const out = [];
    for (const row of raw) {
        const id = String(row?.id || "").trim();
        if (!id || seen.has(id) || APEX_RADAR_CS_DEFAULT_RULE_IDS.has(id)) continue;
        if (!isValidCsPlatform(row.platform) || !isValidCsKpiForPlatform(row.platform, row.kpi)) continue;
        if (!isValidCsPeriod(row.period)) continue;
        seen.add(id);
        out.push({
            id,
            platform: row.platform,
            kpi: row.kpi,
            period: row.period,
            dropPct: clampCsDropPct(row.dropPct, 70),
            enabled: row.enabled !== false,
        });
    }
    return out;
}

function customerIdFromRequest(request, body = null) {
    const { searchParams } = new URL(request.url);
    const fromQuery = String(searchParams.get("customerId") || "").trim();
    if (isApexRadarCsCustomerId(fromQuery)) return fromQuery;
    const fromBody = String(body?.customerId || "").trim();
    if (isApexRadarCsCustomerId(fromBody)) return fromBody;
    return "";
}

/**
 * GET /api/apex-radar/cs/settings?customerId=
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const customerId = customerIdFromRequest(request);
    if (!customerId) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const exists = await Customer.findById(customerId).select("_id").lean();
        if (!exists) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        const doc = await ApexRadarCsCustomerSettings.findOne({
            customerId,
        }).lean();
        return NextResponse.json({
            customerId,
            settings: serializeCsSettings(doc),
        });
    } catch (e) {
        console.error("[apex-radar/cs/settings GET]", e);
        return NextResponse.json({ error: e.message || "Failed to load CS settings" }, { status: 500 });
    }
}

/**
 * PATCH /api/apex-radar/cs/settings
 * Body: { customerId?, slackChannelId?, slackChannelName?, defaultOverrides?, customRules? }
 */
export async function PATCH(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const customerId = customerIdFromRequest(request, body);
    if (!customerId) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const exists = await Customer.findById(customerId).select("_id").lean();
        if (!exists) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const cid = new mongoose.Types.ObjectId(customerId);
        const update = { updatedAt: new Date() };

        if (body.slackChannelId !== undefined) {
            update.slackChannelId = String(body.slackChannelId || "").trim();
        }
        if (body.slackChannelName !== undefined) {
            update.slackChannelName = String(body.slackChannelName || "")
                .trim()
                .replace(/^#/, "");
        }
        if (body.defaultOverrides !== undefined) {
            const overrides = normalizeDefaultOverrides(body.defaultOverrides);
            if (!overrides) {
                return NextResponse.json({ error: "Invalid defaultOverrides" }, { status: 400 });
            }
            update.defaultOverrides = overrides;
        }
        if (body.customRules !== undefined) {
            const custom = normalizeCustomRules(body.customRules);
            if (!custom) {
                return NextResponse.json({ error: "Invalid customRules" }, { status: 400 });
            }
            update.customRules = custom;
        }

        const saved = await ApexRadarCsCustomerSettings.findOneAndUpdate(
            { customerId: cid },
            { $set: update },
            { upsert: true, new: true, runValidators: true }
        ).lean();

        return NextResponse.json({
            customerId,
            settings: serializeCsSettings(saved),
        });
    } catch (e) {
        console.error("[apex-radar/cs/settings PATCH]", e);
        return NextResponse.json({ error: e.message || "Failed to save CS settings" }, { status: 500 });
    }
}
