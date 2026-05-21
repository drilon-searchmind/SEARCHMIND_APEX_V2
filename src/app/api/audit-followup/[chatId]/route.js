import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import AuditFollowUpChat from "@/models/AuditFollowUpChat";
import {
    callAuditAnthropicMessages,
    getAuditAnthropicModel,
    isAuditAiConfigured,
} from "@/lib/audit/auditAnthropic";
import { buildAuditFollowUpSystemPrompt } from "@/lib/audit/auditFollowUpPrompt";

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
        const { auditReportSnapshot: _snap, ...rest } = chat;
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
        const message = body?.message != null ? String(body.message).trim() : "";
        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        await connectToDatabase();
        const chat = await AuditFollowUpChat.findById(chatId);
        if (!chat || chat.status !== "active") {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        chat.messages.push({
            type: "user",
            content: message,
            timestamp: new Date(),
        });

        const system = buildAuditFollowUpSystemPrompt({
            auditReportSnapshot: chat.auditReportSnapshot,
            dateRange: chat.dateRange,
            comparisonDateRange: chat.comparisonDateRange,
            customerName: chat.customerNameSnapshot,
        });

        const history = chat.messages.slice(-24).map((msg) => ({
            role: msg.type === "user" ? "user" : "assistant",
            content: msg.content,
        }));

        const { text, model, tokensUsed } = await callAuditAnthropicMessages({
            system,
            messages: history,
            maxTokens: 8192,
            temperature: 0.4,
        });

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

        return NextResponse.json({
            type: "ai",
            content: text,
            timestamp: aiMessage.timestamp,
            tokensUsed,
            model: aiMessage.model,
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
 * DELETE /api/audit-followup/[chatId] — archive chat
 */
export async function DELETE(request, { params }) {
    const session = await getServerSession(authOptions);
    const denied = requireInternalStaff(session);
    if (denied) return denied;

    const { chatId } = await params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return NextResponse.json({ error: "Invalid chat id" }, { status: 400 });
    }

    try {
        await connectToDatabase();
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
        console.error("Error archiving audit follow-up chat:", error);
        return NextResponse.json({ error: "Failed to archive chat" }, { status: 500 });
    }
}
