import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    getAuditPromptLibraryForAdmin,
    setAuditPromptActive,
} from "@/lib/audit/auditPromptDb";
import { AUDIT_PROMPT_SCOPES } from "@/lib/audit/auditPromptScopes";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * POST /api/admin/audit-prompts/select
 * Body: { scope, promptId, active?: boolean } — channels toggle; system sets active when active!==false
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
        const promptId = String(body.promptId || "").trim();
        const active = body.active !== false;

        if (!AUDIT_PROMPT_SCOPES.includes(scope)) {
            return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
        }
        if (!promptId) {
            return NextResponse.json({ error: "promptId is required" }, { status: 400 });
        }

        await setAuditPromptActive(scope, promptId, active);
        const library = await getAuditPromptLibraryForAdmin();
        return NextResponse.json(library);
    } catch (e) {
        console.error("[admin audit-prompts select]", e);
        return NextResponse.json(
            { error: e?.message || "Failed to update selection" },
            { status: 400 }
        );
    }
}
