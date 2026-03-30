import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createContentTag } from "../../../../../lib/contentTagOperations";

function requireAdmin(session) {
    if (!session?.user) return null;
    if (!session.user.isAdmin) return false;
    return true;
}

/**
 * POST /api/admin/content-tags
 * body: { label, color?, scopes?: ('tools'|'news')[] }
 */
export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);
        const ok = requireAdmin(session);
        if (!session || ok === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (ok === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await req.json();
        const tag = await createContentTag({
            label: body.label,
            color: body.color,
            scopes: body.scopes,
        });
        return NextResponse.json({ tag }, { status: 201 });
    } catch (e) {
        console.error("[admin content-tags POST]", e);
        return NextResponse.json({ error: e.message || "Failed to create tag" }, { status: 400 });
    }
}
