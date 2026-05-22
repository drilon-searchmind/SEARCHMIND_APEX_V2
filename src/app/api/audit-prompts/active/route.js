import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getActivePromptsForRunAudit } from "@/lib/audit/auditPromptDb";

function requireInternal(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (session.user.isExternal === true && session.user.isAdmin !== true) {
        return { status: 403, error: "Forbidden" };
    }
    return null;
}

/**
 * GET /api/audit-prompts/active — prompts marked active in the library (for Run Audit modal).
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireInternal(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const catalog = await getActivePromptsForRunAudit();
        return NextResponse.json(catalog);
    } catch (e) {
        console.error("[audit-prompts/active GET]", e);
        return NextResponse.json({ error: "Failed to load active audit prompts" }, { status: 500 });
    }
}
