import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import AuditFollowUpChat from "@/models/AuditFollowUpChat";
import CustomerChannelAudit from "@/models/CustomerChannelAudit";
import { getAuditAnthropicModel } from "@/lib/audit/auditAnthropic";

function requireInternalStaff(session) {
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.isExternal === true && session.user.isAdmin !== true) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

function sessionUserId(session) {
    const id = session?.user?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return null;
    return new mongoose.Types.ObjectId(String(id));
}

/**
 * GET /api/audit-followup?customerId=...&auditId=...
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    const denied = requireInternalStaff(session);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const auditId = searchParams.get("auditId");

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        return NextResponse.json({ error: "Invalid or missing customerId" }, { status: 400 });
    }
    if (!auditId || !String(auditId).trim()) {
        return NextResponse.json({ error: "auditId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const chats = await AuditFollowUpChat.find({
            customerId: new mongoose.Types.ObjectId(customerId),
            auditId: String(auditId).trim(),
            status: "active",
        })
            .sort({ updatedAt: -1 })
            .limit(50)
            .select("-auditReportSnapshot")
            .lean();

        return NextResponse.json(chats);
    } catch (error) {
        console.error("Error fetching audit follow-up chats:", error);
        return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
    }
}

/**
 * POST /api/audit-followup — create a new follow-up thread for an audit
 */
export async function POST(request) {
    const session = await getServerSession(authOptions);
    const denied = requireInternalStaff(session);
    if (denied) return denied;

    const userId = sessionUserId(session);
    if (!userId) {
        return NextResponse.json({ error: "Invalid user session" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            customerId,
            auditId,
            title,
            dateRange,
            comparisonDateRange,
            auditReportSnapshot,
            customerName,
            findingContext,
        } = body;

        if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
            return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
        }
        if (!auditId || !String(auditId).trim()) {
            return NextResponse.json({ error: "auditId is required" }, { status: 400 });
        }
        if (!dateRange?.startDate || !dateRange?.endDate) {
            return NextResponse.json({ error: "dateRange is required" }, { status: 400 });
        }

        await connectToDatabase();

        const auditIdStr = String(auditId).trim();
        let reportSnapshot =
            auditReportSnapshot && typeof auditReportSnapshot === "object"
                ? auditReportSnapshot
                : {};
        let nameSnapshot = customerName ? String(customerName) : "";

        if (mongoose.Types.ObjectId.isValid(auditIdStr)) {
            const auditDoc = await CustomerChannelAudit.findById(auditIdStr)
                .select("report customerNameSnapshot")
                .lean();
            if (auditDoc?.report && typeof auditDoc.report === "object") {
                reportSnapshot = auditDoc.report;
            }
            if (!nameSnapshot && auditDoc?.customerNameSnapshot) {
                nameSnapshot = String(auditDoc.customerNameSnapshot);
            }
        }

        const chat = await AuditFollowUpChat.create({
            userId,
            customerId: new mongoose.Types.ObjectId(customerId),
            auditId: auditIdStr,
            title:
                title ||
                `Audit follow-up — ${dateRange.startDate} to ${dateRange.endDate}`,
            dateRange: {
                startDate: String(dateRange.startDate),
                endDate: String(dateRange.endDate),
            },
            comparisonDateRange: comparisonDateRange?.startDate
                ? {
                      startDate: String(comparisonDateRange.startDate),
                      endDate: String(comparisonDateRange.endDate || ""),
                  }
                : undefined,
            customerNameSnapshot: nameSnapshot,
            auditReportSnapshot: reportSnapshot,
            findingContext:
                findingContext && typeof findingContext === "object"
                    ? findingContext
                    : null,
            messages: [],
            status: "active",
            aiModelVersion: getAuditAnthropicModel(),
        });

        const lean = chat.toObject();
        delete lean.auditReportSnapshot;
        return NextResponse.json(lean, { status: 201 });
    } catch (error) {
        console.error("Error creating audit follow-up chat:", error);
        return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });
    }
}
