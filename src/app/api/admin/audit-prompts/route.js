import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    ensureAuditPromptDefaults,
    invalidateAuditPromptCache,
    listAuditPromptsForAdmin,
} from "@/lib/audit/auditPromptDb";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * GET /api/admin/audit-prompts — list all library prompts (seeds missing rows).
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }
        await ensureAuditPromptDefaults();
        const prompts = await listAuditPromptsForAdmin();
        return NextResponse.json({ prompts });
    } catch (e) {
        console.error("[admin audit-prompts GET]", e);
        return NextResponse.json({ error: "Failed to load audit prompts" }, { status: 500 });
    }
}
