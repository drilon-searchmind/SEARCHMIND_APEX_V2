import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    createAuditPrompt,
    ensureAuditPromptLibrary,
    getAuditPromptLibraryForAdmin,
    invalidateAuditPromptCache,
} from "@/lib/audit/auditPromptDb";
import { AUDIT_PROMPT_SCOPES } from "@/lib/audit/auditPromptScopes";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * GET /api/admin/audit-prompts — library grouped by scope + active selection.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }
        await ensureAuditPromptLibrary();
        const library = await getAuditPromptLibraryForAdmin();
        return NextResponse.json(library);
    } catch (e) {
        console.error("[admin audit-prompts GET]", e);
        return NextResponse.json({ error: "Failed to load audit prompts" }, { status: 500 });
    }
}

/**
 * POST /api/admin/audit-prompts — create a new prompt in a scope.
 * Body: { scope, title?, description?, body }
 */
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const body = await request.json().catch(() => ({}));
        const scope = String(body.scope || "").trim();
        if (!AUDIT_PROMPT_SCOPES.includes(scope)) {
            return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
        }

        const userId =
            session.user.id && mongoose.Types.ObjectId.isValid(String(session.user.id))
                ? new mongoose.Types.ObjectId(String(session.user.id))
                : null;

        const prompt = await createAuditPrompt({
            scope,
            title: body.title,
            description: body.description,
            body: body.body,
            userId,
        });

        const library = await getAuditPromptLibraryForAdmin();
        return NextResponse.json({ prompt, ...library }, { status: 201 });
    } catch (e) {
        console.error("[admin audit-prompts POST]", e);
        return NextResponse.json(
            { error: e?.message || "Failed to create prompt" },
            { status: 400 }
        );
    }
}

export { invalidateAuditPromptCache };
