import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    deleteAuditPrompt,
    getAuditPromptLibraryForAdmin,
    updateAuditPrompt,
} from "@/lib/audit/auditPromptDb";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * PUT /api/admin/audit-prompts/[id]
 */
export async function PUT(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const { id } = await params;
        const body = await request.json().catch(() => ({}));

        const userId =
            session.user.id && mongoose.Types.ObjectId.isValid(String(session.user.id))
                ? new mongoose.Types.ObjectId(String(session.user.id))
                : null;

        const prompt = await updateAuditPrompt(id, {
            title: body.title,
            description: body.description,
            body: body.body,
            userId,
        });

        const library = await getAuditPromptLibraryForAdmin();
        return NextResponse.json({ prompt, ...library });
    } catch (e) {
        console.error("[admin audit-prompts PUT]", e);
        return NextResponse.json(
            { error: e?.message || "Failed to save prompt" },
            { status: 400 }
        );
    }
}

/**
 * DELETE /api/admin/audit-prompts/[id]
 */
export async function DELETE(_request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const { id } = await params;
        await deleteAuditPrompt(id);
        const library = await getAuditPromptLibraryForAdmin();
        return NextResponse.json(library);
    } catch (e) {
        console.error("[admin audit-prompts DELETE]", e);
        return NextResponse.json(
            { error: e?.message || "Failed to delete prompt" },
            { status: 400 }
        );
    }
}
