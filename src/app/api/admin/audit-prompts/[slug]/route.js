import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import AuditPromptTemplate from "@/models/AuditPromptTemplate";
import { AUDIT_PROMPT_META, AUDIT_PROMPT_SLUGS } from "@/lib/audit/auditPromptSlugs";
import { invalidateAuditPromptCache } from "@/lib/audit/auditPromptDb";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * PUT /api/admin/audit-prompts/[slug] — update prompt body (and optional title/description).
 */
export async function PUT(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const { slug } = await params;
        if (!AUDIT_PROMPT_SLUGS.includes(slug)) {
            return NextResponse.json({ error: "Invalid prompt slug" }, { status: 400 });
        }

        const body = await request.json();
        const promptBody = body?.body != null ? String(body.body) : "";
        if (!promptBody.trim()) {
            return NextResponse.json({ error: "Prompt body cannot be empty" }, { status: 400 });
        }

        const title =
            body?.title != null && String(body.title).trim()
                ? String(body.title).trim()
                : AUDIT_PROMPT_META[slug]?.title || slug;
        const description =
            body?.description != null ? String(body.description).trim() : "";

        await connectToDatabase();

        const userId =
            session.user.id && mongoose.Types.ObjectId.isValid(String(session.user.id))
                ? new mongoose.Types.ObjectId(String(session.user.id))
                : null;

        const doc = await AuditPromptTemplate.findOneAndUpdate(
            { slug },
            {
                $set: {
                    title,
                    description,
                    body: promptBody,
                    updatedByUserId: userId,
                },
            },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        invalidateAuditPromptCache();

        return NextResponse.json({
            prompt: {
                slug: doc.slug,
                title: doc.title,
                description: doc.description || "",
                body: doc.body,
                sortOrder: doc.sortOrder ?? 0,
                updatedAt: doc.updatedAt,
            },
        });
    } catch (e) {
        console.error("[admin audit-prompts PUT]", e);
        return NextResponse.json({ error: e?.message || "Failed to save prompt" }, { status: 500 });
    }
}
