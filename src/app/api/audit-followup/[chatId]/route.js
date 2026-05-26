import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import AuditFollowUpChat from "@/models/AuditFollowUpChat";
import {
    getAuditAnthropicModel,
    isAuditAiConfigured,
} from "@/lib/audit/auditAnthropic";
import { rejectClientAuditAiOverrides } from "@/lib/audit/auditAiReadOnlyPolicy";
import { buildAuditFollowUpSystemPrompt } from "@/lib/audit/auditFollowUpPrompt";
import { callAuditFollowUpWithOptionalFetch } from "@/lib/audit/auditFollowUpAnthropic";
import {
    fetchAuditFollowUpData,
    mergeEphemeralDataContext,
} from "@/lib/audit/auditFollowUpDataFetch";

function requireInternalStaff(session) {
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.isExternal === true && session.user.isAdmin !== true) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

/**
 * GET /api/audit-followup/[chatId]
 */
export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    const denied = requireInternalStaff(session);
    if (denied) return denied;

    const { chatId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return NextResponse.json({ error: "Invalid chat id" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const chat = await AuditFollowUpChat.findById(chatId).lean();
        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }
        const { auditReportSnapshot: _snap, ephemeralDataContext: _eph, ...rest } = chat;
        return NextResponse.json(rest);
    } catch (error) {
        console.error("Error fetching audit follow-up chat:", error);
        return NextResponse.json({ error: "Failed to fetch chat" }, { status: 500 });
    }
}

/**
 * POST /api/audit-followup/[chatId] — send a user message, get Claude reply
 */
export async function POST(request, { params }) {
    const session = await getServerSession(authOptions);
    const denied = requireInternalStaff(session);
    if (denied) return denied;

    const { chatId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return NextResponse.json({ error: "Invalid chat id" }, { status: 400 });
    }

    if (!isAuditAiConfigured()) {
        return NextResponse.json(
            { error: "CLAUDE_CODE_API_KEY is not configured" },
            { status: 503 }
        );
    }

    try {
        const body = await request.json();
        try {
            rejectClientAuditAiOverrides(body);
        } catch (overrideErr) {
            return NextResponse.json({ error: overrideErr.message }, { status: 400 });
        }

        const message = body?.message != null ? String(body.message).trim() : "";
        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        await connectToDatabase();
        const chat = await AuditFollowUpChat.findById(chatId);
        if (!chat || chat.status !== "active") {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        const messageIndexBefore = chat.messages.length;

        chat.messages.push({
            type: "user",
            content: message,
            timestamp: new Date(),
        });

        const comparison =
            chat.comparisonDateRange?.startDate && chat.comparisonDateRange?.endDate
                ? {
                      startDate: String(chat.comparisonDateRange.startDate),
                      endDate: String(chat.comparisonDateRange.endDate),
                  }
                : null;

        const system = buildAuditFollowUpSystemPrompt({
            auditReportSnapshot: chat.auditReportSnapshot,
            dateRange: chat.dateRange,
            comparisonDateRange: chat.comparisonDateRange,
            customerName: chat.customerNameSnapshot,
            ephemeralDataContext: chat.ephemeralDataContext,
        });

        const history = chat.messages
            .filter((msg) => msg.type === "user" || msg.type === "ai")
            .map((msg) => ({
                role: msg.type === "user" ? "user" : "assistant",
                content: msg.content,
            }));

        const customerId = String(chat.customerId);
        let fetchSummary = "";

        const { text, model, tokensUsed, didFetch } = await callAuditFollowUpWithOptionalFetch({
            system,
            getSystem: () =>
                buildAuditFollowUpSystemPrompt({
                    auditReportSnapshot: chat.auditReportSnapshot,
                    dateRange: chat.dateRange,
                    comparisonDateRange: chat.comparisonDateRange,
                    customerName: chat.customerNameSnapshot,
                    ephemeralDataContext: chat.ephemeralDataContext,
                }),
            messages: history,
            onFetchAuditData: async (input) => {
                const sources = Array.isArray(input.sources) ? input.sources : ["all"];
                const result = await fetchAuditFollowUpData({
                    customerId,
                    startDate: chat.dateRange.startDate,
                    endDate: chat.dateRange.endDate,
                    comparisonDateRange: comparison,
                    sources,
                    reason: input.reason,
                });
                fetchSummary = result.summary;
                chat.ephemeralDataContext = mergeEphemeralDataContext(
                    chat.ephemeralDataContext,
                    result.payload
                );
                chat.markModified("ephemeralDataContext");
                return JSON.stringify(result.toolResult);
            },
        });

        if (didFetch) {
            chat.messages.push({
                type: "data_fetch",
                content:
                    fetchSummary ||
                    "Additional audit data was loaded into this chat (read-only). It is not saved to the audit report.",
                timestamp: new Date(),
            });
        }

        const aiMessage = {
            type: "ai",
            content: text,
            timestamp: new Date(),
            tokensUsed,
            model: model || getAuditAnthropicModel(),
        };
        chat.messages.push(aiMessage);
        chat.aiModelVersion = aiMessage.model;
        await chat.save();

        const newMessages = chat.messages.slice(messageIndexBefore).map((m) => ({
            _id: m._id,
            type: m.type,
            content: m.content,
            timestamp: m.timestamp,
            tokensUsed: m.tokensUsed,
            model: m.model,
        }));

        return NextResponse.json({
            messages: newMessages,
            type: "ai",
            content: text,
            timestamp: aiMessage.timestamp,
            tokensUsed,
            model: aiMessage.model,
            didFetch,
        });
    } catch (error) {
        console.error("Error sending audit follow-up message:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to send message" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/audit-followup/[chatId] — archive chat, or hard-delete with ?purge=true
 */
export async function DELETE(request, { params }) {
    const session = await getServerSession(authOptions);
    const denied = requireInternalStaff(session);
    if (denied) return denied;

    const { chatId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return NextResponse.json({ error: "Invalid chat id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const purge = searchParams.get("purge") === "true";

    try {
        await connectToDatabase();
        if (purge) {
            const deleted = await AuditFollowUpChat.findByIdAndDelete(chatId);
            if (!deleted) {
                return NextResponse.json({ error: "Chat not found" }, { status: 404 });
            }
            return NextResponse.json({ message: "Chat deleted" });
        }

        const chat = await AuditFollowUpChat.findByIdAndUpdate(
            chatId,
            { status: "archived" },
            { new: true }
        );
        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Chat archived" });
    } catch (error) {
        console.error("Error deleting audit follow-up chat:", error);
        return NextResponse.json(
            { error: purge ? "Failed to delete chat" : "Failed to archive chat" },
            { status: 500 }
        );
    }
}
