import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getPublishedNewsBySlug } from "../../../../../lib/newsPostOperations";

export async function GET(req, context) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const params = await context.params;
        const slug = params?.slug;
        if (!slug) {
            return NextResponse.json({ error: "Missing slug" }, { status: 400 });
        }
        const post = await getPublishedNewsBySlug(decodeURIComponent(slug));
        if (!post) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ post });
    } catch (e) {
        console.error("[news slug GET]", e);
        return NextResponse.json({ error: "Failed to load article" }, { status: 500 });
    }
}
