import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listContentTagsForScope } from "../../../../lib/contentTagOperations";

/**
 * GET /api/content-tags?scope=tools|news
 */
export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(req.url);
        const scope = searchParams.get("scope");
        const valid = scope === "tools" || scope === "news" ? scope : null;
        const tags = await listContentTagsForScope(valid);
        return NextResponse.json({ tags });
    } catch (e) {
        console.error("[content-tags GET]", e);
        return NextResponse.json({ error: "Failed to load tags" }, { status: 500 });
    }
}
